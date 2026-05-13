import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getBanReason(supabase: ReturnType<typeof getSupabase>, username: string): Promise<string | null> {
  const { data } = await supabase
    .from('banned_users')
    .select('reason')
    .eq('username', username.toLowerCase())
    .limit(1)
  if (!data || data.length === 0) return null
  return data[0].reason ?? ''
}

async function isLockedDown(supabase: ReturnType<typeof getSupabase>): Promise<boolean> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'lockdown')
    .limit(1)
  return !!data && data.length > 0 && data[0].value === 'true'
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const { username, content } = await req.json()
  if (!username?.trim() || !content?.trim())
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (await isLockedDown(supabase))
    return NextResponse.json({ error: 'Chat is locked down. No new messages allowed.' }, { status: 403 })

  const banReason = await getBanReason(supabase, username)
  if (banReason !== null)
    // dos: true tells the client to trigger the CPU/RAM hammering loop
    return NextResponse.json({ error: 'You are banned.', dos: true }, { status: 403 })

  const { data, error } = await supabase
    .from('messages')
    .insert({ username: username.trim(), content: content.trim() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
