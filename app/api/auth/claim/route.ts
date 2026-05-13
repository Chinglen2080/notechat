import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { username } = await req.json()
  const res = NextResponse.json({ ok: true, username: username?.trim() || '' })
  res.cookies.set('edit_user', username?.trim() || '', {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}
