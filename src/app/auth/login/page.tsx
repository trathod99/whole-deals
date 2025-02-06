import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LoginButton from './login-button'

export default async function LoginPage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-10 shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Welcome to Whole Foods Deals
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to get personalized deals from Whole Foods
          </p>
        </div>
        <div className="mt-8">
          <LoginButton />
        </div>
      </div>
    </div>
  )
} 