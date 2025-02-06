import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { scrapeWholeFoods } from '@/lib/scraper'

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

    // Scrape deals
    const deals = await scrapeWholeFoods()

    // Save to scrape history
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

    return NextResponse.json({
      success: true,
      scrapeId: scrapeHistory.id,
      dealsCount: deals.length,
      deals,
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