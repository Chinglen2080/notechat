import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (token !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'lockdown').limit(1)
  const active = !!data && data.length > 0 && data[0].value === 'true'
  return NextResponse.json({ lockdown: active })
}

export async function POST(req: Request) {
  const { adminToken, enable } = await req.json()
  if (adminToken !== process.env.ADMIN_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getSupabase()
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'lockdown', value: enable ? 'true' : 'false' }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, lockdown: enable })
}
