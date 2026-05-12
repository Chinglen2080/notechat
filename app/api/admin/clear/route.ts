import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const { target, adminToken } = await req.json()
  if (adminToken !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['messages', 'notes'].includes(target)) return NextResponse.json({ error: 'Invalid target' }, { status: 400 })

  const supabase = getSupabase()
  const { error } = await supabase.from(target).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
