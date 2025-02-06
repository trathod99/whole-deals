import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { scrapeWholeFoods } from '@/lib/scraper'
import DealsEmail from '@/emails/DealsEmail'
import Anthropic from '@anthropic-ai/sdk'

const resend = new Resend(process.env.RESEND_API_KEY)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    // 1. Scrape deals
    const deals = await scrapeWholeFoods()

    // 2. Save scrape history
    const { data: scrapeHistory, error: scrapeError } = await supabase
      .from('scrape_history')
      .insert({
        successful: true,
        data: deals,
      })
      .select()
      .single()

    if (scrapeError) throw scrapeError

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
      const preferenceContext = preferenceTexts.join('\n')

      // 5. Use Claude to match deals with preferences
      for (const deal of deals) {
        const prompt = `You are evaluating whether a product matches a user's food preferences.

Product Information:
Name: ${deal.product_name}
Description: ${deal.product_description}
Category: ${deal.category}

User's Food Preferences:
${preferenceContext}

Does this product match the user's preferences? Respond with a confidence score (0-100) and a brief explanation.
Format your response exactly like this example:
Score: 85
Explanation: This high-protein snack aligns with the user's preference for protein-rich foods.`

        const response = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 100,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        })

        const messageContent = response.content[0].type === 'text' 
          ? response.content[0].text 
          : ''
          
        const [scoreLine, explanationLine] = messageContent.split('\n')
        const confidenceScore = parseInt(scoreLine.split(': ')[1])
        const explanation = explanationLine.split(': ')[1]

        if (confidenceScore >= 50) {
          // 6. Save matched deal
          await supabase.from('matched_deals').insert({
            scrape_id: scrapeHistory.id,
            user_id: user.id,
            product_name: deal.product_name,
            product_description: deal.product_description,
            sale_price: deal.sale_price,
            regular_price: deal.regular_price,
            discount_percentage: deal.discount_percentage,
            category: deal.category,
            image_url: deal.image_url,
            product_url: deal.product_url,
            confidence_score: confidenceScore,
            matching_explanation: explanation || '',
          })
        }
      }

      // 7. Get all matched deals for the user
      const { data: matchedDeals } = await supabase
        .from('matched_deals')
        .select('*')
        .eq('scrape_id', scrapeHistory.id)
        .eq('user_id', user.id)

      if (matchedDeals && matchedDeals.length > 0) {
        // 8. Send email
        const emailHtml = await render(
          DealsEmail({
            deals: matchedDeals,
            preferences: preferenceTexts,
          })
        )

        if (user.email) {
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