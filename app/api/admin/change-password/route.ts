import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '@/lib/crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const { newMain, newDuress, adminToken } = await req.json()
  if (adminToken !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!newMain || !newDuress) {
    return NextResponse.json({ error: 'Both passwords required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const mainHash = await hashPassword(newMain)
  const duressHash = await hashPassword(newDuress)

  await supabase.from('admin_passwords').update({ password_hash: mainHash, requires_change: false }).eq('is_main', true)
  await supabase.from('admin_passwords').update({ password_hash: duressHash, requires_change: false }).eq('is_duress', true)
  await supabase.from('duress_events').update({ resolved: true }).eq('resolved', false)

  return NextResponse.json({ ok: true })
}
