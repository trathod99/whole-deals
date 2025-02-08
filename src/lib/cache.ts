import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type Deal = Omit<
  Database['public']['Tables']['matched_deals']['Insert'],
  'id' | 'scrape_id' | 'user_id' | 'confidence_score' | 'matching_explanation' | 'created_at'
>

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Time window for considering cache valid (24 hours)
const CACHE_WINDOW_HOURS = 24

export async function getCachedDeals(): Promise<Deal[] | null> {
  try {
    // Get most recent successful scrape
    const { data: scrapeHistory } = await supabase
      .from('scrape_history')
      .select('*')
      .eq('successful', true)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single()

    if (!scrapeHistory) {
      return null
    }

    // Check if cache is still valid
    const scrapeDate = new Date(scrapeHistory.scraped_at)
    const now = new Date()
    const hoursSinceScrape = (now.getTime() - scrapeDate.getTime()) / (1000 * 60 * 60)

    if (hoursSinceScrape > CACHE_WINDOW_HOURS) {
      return null
    }

    // Return cached deals
    return scrapeHistory.data as Deal[]
  } catch (error) {
    console.error('Error getting cached deals:', error)
    return null
  }
}

export async function cacheDeals(deals: Deal[]): Promise<void> {
  try {
    await supabase
      .from('scrape_history')
      .insert({
        successful: true,
        data: deals,
      })
  } catch (error) {
    console.error('Error caching deals:', error)
  }
} 