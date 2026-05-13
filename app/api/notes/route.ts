import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkBan(supabase: ReturnType<typeof getSupabase>, username: string) {
  const { data } = await supabase.from('banned_users').select('reason').eq('username', username.toLowerCase()).limit(1)
  return data && data.length > 0 ? (data[0].reason ?? '') : null
}

async function checkRateLimit(supabase: ReturnType<typeof getSupabase>, username: string, action: string): Promise<boolean> {
  const since = new Date(Date.now() - 60000).toISOString()
  const { count } = await supabase
    .from('note_actions')
    .select('id', { count: 'exact', head: true })
    .eq('username', username.toLowerCase())
    .eq('action', action)
    .gte('created_at', since)
  const limit = action === 'delete' ? 3 : 10
  return (count ?? 0) >= limit
}

async function logAction(supabase: ReturnType<typeof getSupabase>, username: string, noteId: string, action: string) {
  await supabase.from('note_actions').insert({ username: username.toLowerCase(), note_id: noteId, action })
}

async function autoBan(supabase: ReturnType<typeof getSupabase>, username: string, reason: string) {
  await supabase.from('banned_users').upsert({ username: username.toLowerCase(), reason }, { onConflict: 'username' })
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, updated_at, is_protected, encrypted_content, salt, iv, encrypted_decoy, duress_salt, duress_iv, author')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const body = await req.json()
  const { title, content, is_protected, encrypted_content, salt, iv, encrypted_decoy, duress_salt, duress_iv } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const username = req.cookies.get('edit_user')?.value
  if (!username) return NextResponse.json({ error: 'no_auth' }, { status: 401 })

  const banReason = await checkBan(supabase, username)
  if (banReason !== null) return NextResponse.json({ error: 'You are banned.', dos: true }, { status: 403 })

  if (await checkRateLimit(supabase, username, 'edit')) {
    await autoBan(supabase, username, 'auto-ban: note edit rate limit')
    return NextResponse.json({ error: 'You are banned.', dos: true }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      title: title.trim(),
      content: content?.trim() || '',
      is_protected: !!is_protected,
      encrypted_content: encrypted_content || null,
      salt: salt || null,
      iv: iv || null,
      encrypted_decoy: encrypted_decoy || null,
      duress_salt: duress_salt || null,
      duress_iv: duress_iv || null,
      author: username,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAction(supabase, username, data.id, 'edit')
  return NextResponse.json(data)
}
