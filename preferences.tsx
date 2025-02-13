"use client"

import { useState } from "react"
import { Plus, X, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Preference {
  id: string
  text: string
  type: "include" | "exclude"
}

export default function PreferencesScreen() {
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [newPreference, setNewPreference] = useState("")
  const [preferenceType, setPreferenceType] = useState<"include" | "exclude">("include")

  const handleAddPreference = () => {
    if (newPreference.trim()) {
      setPreferences([
        ...preferences,
        {
          id: Math.random().toString(36).substr(2, 9),
          text: newPreference.trim(),
          type: preferenceType,
        },
      ])
      setNewPreference("")
    }
  }

  const handleRemovePreference = (id: string) => {
    setPreferences(preferences.filter((pref) => pref.id !== id))
  }

  const handleSave = () => {
    console.log("Saving preferences:", preferences)
  }

  return (
    <div className="min-h-screen bg-[#F8F7FA] p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 text-right">
          <Button variant="ghost" className="text-zinc-400 text-lg hover:text-zinc-600 hover:bg-transparent">
            Log Out
          </Button>
        </div>

        <div className="mb-16 text-center space-y-6">
          <h1 className="text-[2.75rem] font-bold tracking-tight leading-tight">What are your food preferences?</h1>
          <p className="text-zinc-500 text-xl leading-relaxed max-w-xl mx-auto">
            Your preferences help us customize your weekly deals. You can always change these later.
          </p>
        </div>

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
                    onChange={(e) => setNewPreference(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddPreference()}
                    className="h-14 text-lg rounded-full border-zinc-200 bg-white shadow-sm pl-6 pr-32"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center gap-1 text-base font-normal focus:outline-none">
                        {preferenceType === "include" ? "Include" : "Exclude"}
                        <ChevronDown className="h-4 w-4 text-zinc-400" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-base" onClick={() => setPreferenceType("include")}>
                          Include
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-base" onClick={() => setPreferenceType("exclude")}>
                          Exclude
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <Button
                  onClick={handleAddPreference}
                  size="icon"
                  className="h-14 w-14 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              <Label className="text-lg font-medium">Your preferences</Label>
              <div className="grid gap-3">
                {preferences.length === 0 ? (
                  <p className="text-lg text-zinc-500">No preferences added yet</p>
                ) : (
                  preferences.map((pref) => (
                    <div
                      key={pref.id}
                      className="flex items-center justify-between rounded-full border border-zinc-200 bg-white py-3 px-6 shadow-sm"
                    >
                      <div className="flex items-center gap-3 flex-grow">
                        <span className="text-lg">{pref.text}</span>
                        <span className="rounded-full bg-zinc-100 px-4 py-1 text-sm text-zinc-600">{pref.type}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
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

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => console.log("Testing scrape...")}
            className="h-14 px-12 text-lg font-medium rounded-full border-zinc-200 hover:bg-zinc-50"
          >
            Test Scrape
          </Button>
          <Button
            onClick={handleSave}
            className="h-14 px-12 text-lg font-medium rounded-full bg-zinc-900 text-white hover:bg-zinc-800"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

