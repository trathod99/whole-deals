import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { scrapeWholeFoods } from '@/lib/scraper'
import { getCachedDeals, cacheDeals } from '@/lib/cache'
import { findMatchingDeals } from '@/lib/matching'
import { sendDealsEmail } from '@/lib/email'
import { Database } from '@/types/database.types'

type MatchedDeal = Omit<
  Database['public']['Tables']['matched_deals']['Insert'],
  'id' | 'scrape_id' | 'user_id' | 'created_at'
>

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookieStore 
    })

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting test scrape for user:', user.email)

    // Try to get cached deals first
    let deals = await getCachedDeals()
    let scrapeId: string | null = null

    // If no valid cache, scrape new deals
    if (!deals) {
      console.log('No valid cache found, scraping new deals...')
      deals = await scrapeWholeFoods()
      
      // Save scrape history and cache the results
      const { data: scrapeHistory, error: scrapeError } = await supabase
        .from('scrape_history')
        .insert({
          successful: true,
          data: deals,
        })
        .select()
        .single()

      if (scrapeError) {
        throw scrapeError
      }
      scrapeId = scrapeHistory.id
      console.log('Saved new scrape with ID:', scrapeId)
    } else {
      console.log('Using cached deals from previous scrape')
      // Get the scrape ID from the most recent successful scrape
      const { data: scrapeHistory } = await supabase
        .from('scrape_history')
        .select('id')
        .eq('successful', true)
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single()
      
      if (scrapeHistory) {
        scrapeId = scrapeHistory.id
        console.log('Using existing scrape ID:', scrapeId)
      }
    }

    // Get user's preferences
    console.log('Fetching user preferences...')
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)

    // Find matching deals
    const preferenceTexts = preferences?.map(p => 
      p.preference_type === 'exclude' ? `no ${p.preference_text}` : p.preference_text
    ) || []
    console.log('User preferences:', preferenceTexts)

    let matchedDeals: MatchedDeal[] = []
    let emailResult = null

    if (preferenceTexts.length > 0) {
      console.log('Finding matching deals...')
      matchedDeals = await findMatchingDeals(deals, preferenceTexts)
      console.log(`Found ${matchedDeals.length} matching deals`)

      // Save matches if we have a scrape ID
      if (scrapeId && matchedDeals.length > 0) {
        console.log('Saving matched deals to database...')
        const dealsToInsert = matchedDeals.map(deal => ({
          scrape_id: scrapeId,
          user_id: user.id,
          product_name: deal.product_name,
          product_description: deal.product_description,
          sale_price: deal.sale_price,
          regular_price: deal.regular_price,
          discount_percentage: deal.discount_percentage,
          category: deal.category,
          image_url: deal.image_url,
          product_url: deal.product_url,
          confidence_score: deal.confidence_score,
          matching_explanation: deal.matching_explanation,
        }))

        await supabase.from('matched_deals').insert(dealsToInsert)
        console.log('Saved matched deals to database')

        // Send email with the matching deals
        if (user.email) {
          console.log('Sending email to user:', user.email)
          emailResult = await sendDealsEmail(
            user.email,
            matchedDeals,
            preferenceTexts
          )
          console.log('Email result:', emailResult)
        }
      }
    } else {
      console.log('No preferences found for user')
    }

    return NextResponse.json({
      success: true,
      scrapeId,
      dealsCount: deals.length,
      deals: deals,
      matchedDeals: matchedDeals,
      preferences: preferenceTexts,
      emailResult
    })
  } catch (error) {
    console.error('Test scraping error:', error)

    // Save error to scrape history if we have auth
    try {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ 
        cookies: () => cookieStore 
      })
      
      await supabase.from('scrape_history').insert({
        successful: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
    } catch (e) {
      console.error('Failed to save error to scrape history:', e)
    }

    return NextResponse.json(
      { error: 'Failed to scrape deals' },
      { status: 500 }
    )
  }
} 