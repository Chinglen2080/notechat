import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPassword } from '@/lib/crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST() {
  const supabase = getSupabase()

  // Check if already initialised
  const { data: existing } = await supabase.from('admin_passwords').select('id').limit(1)
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Already initialised' }, { status: 400 })
  }

  const mainHash = await hashPassword('Chinglen4Enclave')
  const duressHash = await hashPassword('Chinglen@14')
  const afterDuressHash = await hashPassword('Ch1ngl3n@ia')

  const { error } = await supabase.from('admin_passwords').insert([
    { password_hash: mainHash, label: 'main', is_main: true, is_duress: false, requires_change: false },
    { password_hash: duressHash, label: 'duress', is_main: false, is_duress: true, requires_change: false },
    { password_hash: afterDuressHash, label: 'after-duress', is_main: false, is_duress: false, requires_change: true },
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
