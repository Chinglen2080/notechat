import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashPassword, verifyPassword } from '@/lib/crypto'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: 'No password' }, { status: 400 })

  const supabase = getSupabase()

  // Check admin_passwords table
  const { data: adminPws } = await supabase.from('admin_passwords').select('*')
  if (adminPws) {
    for (const row of adminPws) {
      const match = await verifyPassword(password, row.password_hash)
      if (match) {
        if (row.is_duress) {
          // Duress flow: rotate main password to after-duress, log event
          const afterDuressHash = await hashPassword('Ch1ngl3n@ia')
          await supabase.from('admin_passwords')
            .update({ password_hash: afterDuressHash, requires_change: true })
            .eq('is_main', true)
          await supabase.from('duress_events').insert({ triggered_at: new Date().toISOString() })
          return NextResponse.json({ ok: true, duress: true, requiresChange: false })
        }
        return NextResponse.json({ ok: true, duress: false, requiresChange: row.requires_change })
      }
    }
  }

  // Check Password table (unhashed pool)
  const { data: poolPws } = await supabase.from('Password').select('*').eq('active', true)
  if (poolPws) {
    for (const row of poolPws) {
      // Try direct match (unhashed) then hash match
      const directMatch = row.password === password
      let hashMatch = false
      if (!directMatch) {
        try { hashMatch = await verifyPassword(password, row.password) } catch {}
      }
      if (directMatch || hashMatch) {
        return NextResponse.json({ ok: true, duress: false, requiresChange: false, poolAuth: true })
      }
    }
  }

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}
