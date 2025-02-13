import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PreferencesForm from '@/components/PreferencesForm'

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
    <PreferencesForm 
      userId={session.user.id} 
      initialPreferences={preferences || []} 
    />
  )
}
