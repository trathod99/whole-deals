import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  console.log('Auth callback URL:', requestUrl.toString())
  console.log('Auth code present:', !!code)

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('Session exchange error:', error)
        return NextResponse.redirect(new URL('/auth/error', requestUrl.origin))
      }
    } catch (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/auth/error', requestUrl.origin))
    }
  }

  // Add cache-control header to prevent caching
  const response = NextResponse.redirect(new URL('/', requestUrl.origin))
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
} 