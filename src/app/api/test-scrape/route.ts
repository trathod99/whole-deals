import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { scrapeWholeFoods } from '@/lib/scraper'
import { getCachedDeals, cacheDeals } from '@/lib/cache'
import { findMatchingDeals } from '@/lib/matching'

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
      }
    }

    // Get user's preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)

    // Find matching deals
    const preferenceTexts = preferences?.map(p => p.preference_text) || []
    const matchedDeals = preferenceTexts.length > 0
      ? await findMatchingDeals(deals, preferenceTexts)
      : []

    // Save matches if we have a scrape ID
    if (scrapeId && matchedDeals.length > 0) {
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
    }

    return NextResponse.json({
      success: true,
      scrapeId,
      dealsCount: deals.length,
      deals: deals,
      matchedDeals: matchedDeals,
      preferences: preferenceTexts,
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