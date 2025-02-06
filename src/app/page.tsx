import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import PreferencesForm from '@/components/PreferencesForm'
import TestScraper from '@/components/TestScraper'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Fetch user preferences
  const { data: preferences, error: preferencesError } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (preferencesError) {
    console.error('Error fetching preferences:', preferencesError)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Whole Foods Deals
            </h1>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="rounded-lg bg-white shadow">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Food Preferences
                </h2>
                <PreferencesForm 
                  userId={session.user.id} 
                  initialPreferences={preferences || []} 
                />
              </div>
            </div>

            <div className="rounded-lg bg-white shadow">
              <div className="p-6">
                <TestScraper />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
