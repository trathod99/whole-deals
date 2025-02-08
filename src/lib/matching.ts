import { Anthropic } from '@anthropic-ai/sdk'
import { Database } from '@/types/database.types'

type Deal = Omit<
  Database['public']['Tables']['matched_deals']['Insert'],
  'id' | 'scrape_id' | 'user_id' | 'confidence_score' | 'matching_explanation' | 'created_at'
>

interface MatchResult {
  confidence: number
  explanation: string
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function matchDealWithPreference(
  deal: Deal,
  preference: string
): Promise<MatchResult> {
  const prompt = `You are evaluating if a product matches a specific food preference.

Product Information:
- Name: ${deal.product_name}
- Description: ${deal.product_description || 'No description available'}
- Category: ${deal.category}

User's Food Preference: "${preference}"

Please analyze if this product matches the user's preference. Consider:
1. Direct matches (e.g., "organic" preference matches "organic apples")
2. Category matches (e.g., "high protein" matches meat products)
3. Ingredient implications (e.g., "no dairy" should exclude milk products)
4. Nutritional alignment (e.g., "healthy snacks" matches appropriate items)

Respond with a confidence score (0-100) and a brief explanation.
Format your response exactly like this example:
Score: 85
Explanation: This high-protein snack aligns with the user's preference for protein-rich foods.`

  try {
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
    const confidence = parseInt(scoreLine.split(': ')[1])
    const explanation = explanationLine.split(': ')[1]

    return {
      confidence,
      explanation: explanation || 'No explanation provided',
    }
  } catch (error) {
    console.error('Error matching deal with preference:', error)
    return {
      confidence: 0,
      explanation: 'Error analyzing match',
    }
  }
}

export async function findMatchingDeals(
  deals: Deal[],
  preferences: string[]
): Promise<Array<Deal & { confidence_score: number; matching_explanation: string }>> {
  const matchingDeals: Array<Deal & { confidence_score: number; matching_explanation: string }> = []

  for (const deal of deals) {
    let highestConfidence = 0
    let bestExplanation = ''

    // Check each preference
    for (const preference of preferences) {
      const { confidence, explanation } = await matchDealWithPreference(deal, preference)
      
      // Keep track of the highest confidence match
      if (confidence > highestConfidence) {
        highestConfidence = confidence
        bestExplanation = explanation
      }

      // If we've found a good match, no need to check other preferences
      if (confidence >= 50) {
        break
      }
    }

    // If any preference matched with >50% confidence, include the deal
    if (highestConfidence >= 50) {
      matchingDeals.push({
        ...deal,
        confidence_score: highestConfidence,
        matching_explanation: bestExplanation,
      })
    }
  }

  return matchingDeals
} 