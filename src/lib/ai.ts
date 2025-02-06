import Anthropic from '@anthropic-ai/sdk'
import type { Product } from '@/types/scraper.types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface MatchResult {
  isMatch: boolean
  confidence: number
  explanation: string
}

export async function matchDealWithPreferences(
  deal: Product,
  preferences: string[]
): Promise<MatchResult> {
  const prompt = `
    You are evaluating if a product matches a user's food preferences.
    
    Product:
    - Name: ${deal.name}
    - Description: ${deal.description}
    - Category: ${deal.category}
    
    User's Food Preferences:
    ${preferences.map((pref) => `- ${pref}`).join('\n')}
    
    Please analyze if this product matches the user's preferences. Consider:
    1. Direct matches (e.g., "organic" preference matches "organic apples")
    2. Category matches (e.g., "high protein" matches meat products)
    3. Ingredient implications (e.g., "no dairy" should exclude milk products)
    4. Nutritional alignment (e.g., "healthy snacks" matches appropriate items)
    
    Respond in this format:
    {
      "isMatch": true/false,
      "confidence": 0-100,
      "explanation": "Brief explanation of the match or mismatch"
    }
  `

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 300,
      temperature: 0,
      system: 'You are a helpful assistant that evaluates food products against user preferences. You only respond in valid JSON format.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    if (!response.content[0] || typeof response.content[0].text !== 'string') {
      throw new Error('Invalid response format from Claude')
    }

    const result = JSON.parse(response.content[0].text) as MatchResult
    return result
  } catch (error) {
    console.error('Error matching deal with preferences:', error)
    return {
      isMatch: false,
      confidence: 0,
      explanation: 'Error analyzing product match',
    }
  }
} 