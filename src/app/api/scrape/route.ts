import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { scrapeWholeFoods } from '@/lib/scraper'
import { getCachedDeals, cacheDeals } from '@/lib/cache'
import { findMatchingDeals } from '@/lib/matching'
import DealsEmail from '@/emails/DealsEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    // 1. Try to get cached deals first
    let deals = await getCachedDeals()
    let scrapeId: string | null = null

    // 2. If no valid cache, scrape new deals
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

      if (scrapeError) throw scrapeError
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

    if (!scrapeId) {
      throw new Error('Failed to get scrape ID')
    }

    // 3. Get all users and their preferences
    const { data: users } = await supabase.auth.admin.listUsers()
    const { data: allPreferences } = await supabase
      .from('user_preferences')
      .select('*')

    if (!users || !allPreferences) {
      throw new Error('Failed to fetch users or preferences')
    }

    // 4. For each user, match deals with their preferences
    for (const user of users.users) {
      const userPreferences = allPreferences.filter(p => p.user_id === user.id)
      if (!userPreferences.length) continue

      const preferenceTexts = userPreferences.map(p => p.preference_text)
      
      // Find matching deals for this user
      const matchedDeals = await findMatchingDeals(deals, preferenceTexts)

      // Save matched deals to database
      if (matchedDeals.length > 0) {
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

        // Send email if we found matches
        if (user.email) {
          const emailHtml = await render(
            DealsEmail({
              deals: matchedDeals,
              preferences: preferenceTexts,
            })
          )

          await resend.emails.send({
            from: 'Whole Foods Deals <deals@resend.dev>',
            to: user.email,
            subject: `Found ${matchedDeals.length} Whole Foods deals matching your preferences`,
            html: emailHtml,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Scraping error:', error)

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