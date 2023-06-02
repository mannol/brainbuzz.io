import '@/app/firebase-admin'
import { cookies } from 'next/headers'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  requestUrl.host = request.headers.get('x-forwarded-host')?.split(',')[0] || requestUrl.host
  requestUrl.protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0] || requestUrl.protocol

  if (process.env.NODE_ENV === 'development' && requestUrl.host.includes('ngrok-free.app')) {
    requestUrl.port = ''
  }

  const redirectTo = requestUrl.searchParams.get('redirectTo')

  const redirectUrl = new URL(redirectTo || '/', requestUrl)
  redirectUrl.search = 'logout=1'

  const cookieStore = cookies()

  const sessionCookie = cookieStore.get('session')

  if (!sessionCookie) {
    return NextResponse.redirect(redirectUrl)
  }

  cookieStore.delete({
    ...sessionCookie,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.redirect(redirectUrl)
}
