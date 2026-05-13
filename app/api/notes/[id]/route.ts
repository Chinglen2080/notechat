import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabase()
  const body = await req.json()
  const { title, content, is_protected, encrypted_content, salt, iv, encrypted_decoy, duress_salt, duress_iv } = body
  const { data, error } = await supabase
    .from('notes')
    .update({
      title,
      content: content || '',
      updated_at: new Date().toISOString(),
      is_protected: !!is_protected,
      encrypted_content: encrypted_content || null,
      salt: salt || null,
      iv: iv || null,
      encrypted_decoy: encrypted_decoy || null,
      duress_salt: duress_salt || null,
      duress_iv: duress_iv || null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getSupabase()
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
