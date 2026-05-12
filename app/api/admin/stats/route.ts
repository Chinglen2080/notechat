import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (token !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const [msgs, notes, banned, duress] = await Promise.all([
    supabase.from('messages').select('id', { count: 'exact', head: true }),
    supabase.from('notes').select('id', { count: 'exact', head: true }),
    supabase.from('banned_users').select('*').order('banned_at', { ascending: false }),
    supabase.from('duress_events').select('*').order('triggered_at', { ascending: false }).limit(5),
  ])

  return NextResponse.json({
    messageCount: msgs.count ?? 0,
    noteCount: notes.count ?? 0,
    bannedUsers: banned.data ?? [],
    duressEvents: duress.data ?? [],
  })
}
