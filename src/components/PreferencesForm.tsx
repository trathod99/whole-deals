'use client'

import React, { useState, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Database, PreferenceType } from '@/types/database.types'
import { Plus, X, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// The Database row for a user preference
type PreferenceRow = Database['public']['Tables']['user_preferences']['Row']

// Convert Supabase row -> local state
function toLocalPreference(pref: PreferenceRow) {
  return {
    id: pref.id,
    text: pref.preference_text,
    type: pref.preference_type as 'include' | 'exclude',
  }
}

// Convert local state -> insert object
function toInsertObject(
  userId: string,
  text: string,
  type: 'include' | 'exclude'
) {
  return {
    user_id: userId,
    preference_text: text,
    preference_type: type,
  }
}

interface PreferencesFormProps {
  userId: string
  initialPreferences: PreferenceRow[]
}

export default function PreferencesForm({
  userId,
  initialPreferences,
}: PreferencesFormProps) {
  // Transform the Supabase rows into our local shape
  const [preferences, setPreferences] = useState<
    { id: string; text: string; type: 'include' | 'exclude' }[]
  >(() => initialPreferences.map(toLocalPreference))

  const [newPreference, setNewPreference] = useState('')
  const [preferenceType, setPreferenceType] = useState<'include' | 'exclude'>(
    'include'
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  // Supabase insert
  const handleAddPreference = async () => {
    const trimmed = newPreference.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from('user_preferences')
        .insert(toInsertObject(userId, trimmed, preferenceType))
        .select('*')
        .single()

      if (insertError) {
        console.error('Error adding preference:', insertError)
        setError(insertError.message)
        return
      }

      if (data) {
        setPreferences((prev) => [...prev, toLocalPreference(data)])
        setNewPreference('')
      }
    } catch (error) {
      console.error('Error adding preference:', error)
      setError('Failed to add preference. Please try again.')
    } finally {
      setIsSubmitting(false)
      // Refresh page or data
      router.refresh()
    }
  }

  // Supabase delete
  const handleRemovePreference = async (id: string) => {
    setError(null)
    try {
      const { error: deleteError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting preference:', deleteError)
        setError(deleteError.message)
        return
      }

      setPreferences((prev) => prev.filter((pref) => pref.id !== id))
    } catch (error) {
      console.error('Error deleting preference:', error)
      setError('Failed to delete preference. Please try again.')
    } finally {
      router.refresh()
    }
  }

  // Example "Save" button logic (optional - your old code saved as you went)
  const handleSave = () => {
    // You may not actually need this if insertion/deletion is enough
    console.log('Preferences (already saved to DB):', preferences)
  }

  // Simplified test scrape handler without toast notifications
  const handleTestScrape = useCallback(async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/test-scrape')  // Changed: GET request to /api/test-scrape
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape deals')
      }

      // Log the result like the original did
      console.log('Test scrape results:', data)
    } catch (error) {
      console.error('Error testing scraper:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }, [])  // No dependencies needed since we're not using userId anymore

  // Add this handler
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#F8F7FA]">
      <div className="mx-auto max-w-2xl px-6 py-8 md:px-8">
        {/* Update the sign out button */}
        <div className="mb-12 text-right">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="text-zinc-400 text-lg hover:text-zinc-600 hover:bg-transparent"
          >
            Sign Out
          </Button>
        </div>

        {/* Main heading */}
        <div className="mb-16 text-center space-y-6">
          <h1 className="text-[2.75rem] font-bold tracking-tight leading-tight">
            What are your food preferences?
          </h1>
          <p className="text-zinc-500 text-xl leading-relaxed max-w-xl mx-auto">
            Your preferences help us customize your weekly deals. You can always
            change these later.
          </p>
        </div>

        {/* Preferences controls */}
        <div className="space-y-8 mb-16">
          <div className="grid gap-6">
            <div className="grid gap-4">
              <Label htmlFor="preference" className="text-lg font-medium">
                Add a preference
              </Label>
              <div className="flex gap-3 items-center">
                <div className="relative flex-grow">
                  <Input
                    id="preference"
                    placeholder="e.g., high protein, no seafood"
                    value={newPreference}
                    disabled={isSubmitting}
                    onChange={(e) => setNewPreference(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPreference()}
                    className="h-14 text-lg rounded-full border-zinc-200 bg-white shadow-sm pl-6 pr-32"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex items-center gap-1 text-base font-normal focus:outline-none"
                        disabled={isSubmitting}
                      >
                        {preferenceType === 'include' ? 'Include' : 'Exclude'}
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-base"
                          onClick={() => setPreferenceType('include')}
                        >
                          Include
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-base"
                          onClick={() => setPreferenceType('exclude')}
                        >
                          Exclude
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <Button
                  onClick={handleAddPreference}
                  size="icon"
                  disabled={isSubmitting || !newPreference.trim()}
                  className="h-14 w-14 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="grid gap-4">
              <Label className="text-lg font-medium">Your preferences</Label>
              <div className="grid gap-3">
                {preferences.length === 0 ? (
                  <p className="text-lg text-zinc-500">
                    No preferences added yet
                  </p>
                ) : (
                  preferences.map((pref) => (
                    <div
                      key={pref.id}
                      className="flex items-center justify-between rounded-full border border-zinc-200 bg-white py-3 px-6 shadow-sm"
                    >
                      <div className="flex items-center gap-3 flex-grow">
                        <span className="text-lg">{pref.text}</span>
                        <span
                          className="rounded-full bg-zinc-100 px-4 py-1 text-sm text-zinc-600"
                        >
                          {pref.type}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSubmitting}
                        onClick={() => handleRemovePreference(pref.id)}
                        className="hover:bg-zinc-100 transition-colors ml-2 rounded-full"
                      >
                        <X className="h-5 w-5 text-zinc-400" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Example bottom buttons */}
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={handleTestScrape}
            disabled={isSubmitting}
            className="h-14 px-12 text-lg font-medium rounded-full border-zinc-200 hover:bg-zinc-50"
          >
            {isSubmitting ? 'Testing...' : 'Test Scrape'}
          </Button>
          <Button
            onClick={handleSave}
            className="h-14 px-12 text-lg font-medium rounded-full bg-zinc-900 text-white hover:bg-zinc-800"
            disabled={isSubmitting}
          >
            Save
          </Button>
        </div>
      </div>
    </main>
  )
} 