import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { scrapeWholeFoods } from '@/lib/scraper'
import { getCachedDeals, cacheDeals } from '@/lib/cache'
import { findMatchingDeals } from '@/lib/matching'
import { sendDealsEmail } from '@/lib/email'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  console.log('Starting scrape process...')

  try {
    // 1. Try to get cached deals first
    let deals = await getCachedDeals()
    let scrapeId: string | null = null

    // 2. If no valid cache, scrape new deals
    if (!deals) {
      console.log('No valid cache found, scraping new deals...')
      deals = await scrapeWholeFoods()
      console.log(`Scraped ${deals.length} deals`)
      
      // Save scrape history and cache the results
      const { data: scrapeHistory, error: scrapeError } = await supabase
        .from('scrape_history')
        .insert({
          successful: true,
          data: deals,
        })
        .select()
        .single()

      if (scrapeError) throw scrapeError
      scrapeId = scrapeHistory.id
      console.log('Saved scrape history with ID:', scrapeId)
    } else {
      console.log(`Using ${deals.length} cached deals from previous scrape`)
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

    if (!scrapeId) {
      throw new Error('Failed to get scrape ID')
    }

    // 3. Get all users and their preferences
    console.log('Fetching users and preferences...')
    const { data: users } = await supabase.auth.admin.listUsers()
    const { data: allPreferences } = await supabase
      .from('user_preferences')
      .select('*')

    if (!users || !allPreferences) {
      throw new Error('Failed to fetch users or preferences')
    }

    console.log(`Found ${users.users.length} users and ${allPreferences.length} preferences`)

    // 4. For each user, match deals with their preferences and send email
    const emailResults = []
    for (const user of users.users) {
      console.log(`Processing user: ${user.email}`)
      const userPreferences = allPreferences.filter(p => p.user_id === user.id)
      if (!userPreferences.length || !user.email) {
        console.log('Skipping user - no preferences or email')
        continue
      }

      const preferenceTexts = userPreferences.map(p => p.preference_text)
      console.log('User preferences:', preferenceTexts)
      
      // Find matching deals for this user
      console.log('Finding matching deals...')
      const matchedDeals = await findMatchingDeals(deals, preferenceTexts)
      console.log(`Found ${matchedDeals.length} matching deals`)

      // Save matched deals to database
      if (matchedDeals.length > 0) {
        console.log('Saving matched deals to database...')
        const dealsToInsert = matchedDeals.map(deal => ({
          scrape_id: scrapeId!,
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
        console.log('Matched deals saved successfully')

        // Send email with proper error handling
        console.log('Sending email to user...')
        const emailResult = await sendDealsEmail(
          user.email,
          matchedDeals,
          preferenceTexts
        )
        
        console.log('Email result:', emailResult)
        emailResults.push({
          email: user.email,
          success: emailResult.success,
          error: emailResult.error
        })
      } else {
        console.log('No matching deals found for user')
      }
    }

    return NextResponse.json({ 
      success: true,
      emailResults 
    })
  } catch (error) {
    console.error('Scraping error:', error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }

    // Save error to scrape history
    await supabase.from('scrape_history').insert({
      successful: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      { error: 'Failed to scrape deals' },
      { status: 500 }
    )
  }
} 