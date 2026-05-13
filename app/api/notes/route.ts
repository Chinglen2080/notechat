import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, updated_at, is_protected, encrypted_content, salt, iv, encrypted_decoy, duress_salt, duress_iv')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { title, content, is_protected, encrypted_content, salt, iv, encrypted_decoy, duress_salt, duress_iv } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
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
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
