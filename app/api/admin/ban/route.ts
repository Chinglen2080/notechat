import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const { username, reason, adminToken } = await req.json()
  if (adminToken !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!username?.trim()) return NextResponse.json({ error: 'Username required' }, { status: 400 })

  const supabase = getSupabase()
  const { error } = await supabase.from('banned_users').upsert({ username: username.trim().toLowerCase(), reason: reason ?? '' }, { onConflict: 'username' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { username, adminToken } = await req.json()
  if (adminToken !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { error } = await supabase.from('banned_users').delete().eq('username', username.trim().toLowerCase())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
