import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function isBanned(supabase: ReturnType<typeof getSupabase>, username: string): Promise<boolean> {
  const { data } = await supabase
    .from('banned_users')
    .select('id')
    .eq('username', username.toLowerCase())
    .limit(1)
  return !!data && data.length > 0
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
  if (await isBanned(supabase, username))
    return NextResponse.json({ error: 'You are banned.' }, { status: 403 })
  const { data, error } = await supabase
    .from('messages')
    .insert({ username: username.trim(), content: content.trim() })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
