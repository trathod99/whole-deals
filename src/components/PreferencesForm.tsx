'use client'

import { useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database, PreferenceType } from '@/types/database.types'
import { useRouter } from 'next/navigation'

type Preference = Database['public']['Tables']['user_preferences']['Row']

interface PreferencesFormProps {
  userId: string
  initialPreferences: Preference[]
}

export default function PreferencesForm({ userId, initialPreferences }: PreferencesFormProps) {
  const [preferences, setPreferences] = useState<Preference[]>(initialPreferences)
  const [newPreference, setNewPreference] = useState('')
  const [preferenceType, setPreferenceType] = useState<PreferenceType>('include')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  const handleAddPreference = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPreference.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          preference_text: newPreference.trim(),
          preference_type: preferenceType,
        })
        .select('*')
        .single()

      if (insertError) {
        console.error('Error adding preference:', insertError)
        setError(insertError.message)
        return
      }

      if (data) {
        setPreferences((prev) => [...prev, data])
        setNewPreference('')
        setPreferenceType('include') // Reset to default
        router.refresh()
      }
    } catch (error) {
      console.error('Error adding preference:', error)
      setError('Failed to add preference. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePreference = async (preferenceId: string) => {
    setError(null)
    try {
      const { error: deleteError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('id', preferenceId)

      if (deleteError) {
        console.error('Error deleting preference:', deleteError)
        setError(deleteError.message)
        return
      }

      setPreferences((prev) => prev.filter((p) => p.id !== preferenceId))
      router.refresh()
    } catch (error) {
      console.error('Error deleting preference:', error)
      setError('Failed to delete preference. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddPreference} className="space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            value={newPreference}
            onChange={(e) => setNewPreference(e.target.value)}
            placeholder="Enter a food preference (e.g., 'high protein', 'seafood')"
            className="flex-1 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          />
          <select
            value={preferenceType}
            onChange={(e) => setPreferenceType(e.target.value as PreferenceType)}
            className="rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
          </select>
          <button
            type="submit"
            disabled={isSubmitting || !newPreference.trim()}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Preference'}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-2">
        {preferences.length === 0 ? (
          <p className="text-sm text-gray-500">No preferences added yet.</p>
        ) : (
          preferences.map((preference) => (
            <div
              key={preference.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  preference.preference_type === 'include' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {preference.preference_type === 'include' ? 'Include' : 'Exclude'}
                </span>
                <span className="text-sm text-gray-700">{preference.preference_text}</span>
              </div>
              <button
                onClick={() => handleDeletePreference(preference.id)}
                className="ml-2 text-sm font-medium text-red-600 hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
} 