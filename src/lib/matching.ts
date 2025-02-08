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

interface BatchMatchResult {
  dealIndex: number
  preferenceIndex: number
  confidence: number
  explanation: string
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Batch size for processing deals
const BATCH_SIZE = 5 // Reduced batch size for better accuracy
// Maximum number of concurrent calls
const MAX_CONCURRENT_CALLS = 3

async function matchDealBatch(
  deals: Deal[],
  preferences: string[],
  batchStartIndex: number // Add batch start index
): Promise<BatchMatchResult[]> {
  const prompt = `You are evaluating if products match specific food preferences.

Products:
${deals.map((deal, i) => `
Product ${i + 1}:
- Name: ${deal.product_name}
- Description: ${deal.product_description || 'No description available'}
- Category: ${deal.category}
`).join('\n')}

Preferences:
${preferences.map((pref, i) => `${i + 1}. ${pref}`).join('\n')}

For each product-preference combination, analyze if there's a match. Consider:
1. Direct matches (e.g., "organic" preference matches "organic apples")
2. Category matches (e.g., "high protein" matches meat products)
3. Ingredient implications (e.g., "no dairy" should exclude milk products)
4. Nutritional alignment (e.g., "healthy snacks" matches appropriate items)

IMPORTANT: For each match, ensure the explanation specifically references the product name and why it matches the preference.

Respond with a JSON array of matches. Each match should have this format:
{
  "dealIndex": number,      // 0-based index of the product in this batch
  "preferenceIndex": number,// 0-based index of the preference
  "confidence": number,     // 0-100 confidence score
  "explanation": string     // Brief explanation of why THIS SPECIFIC product matches
}

Only include matches with confidence >= 50. Format the response as a valid JSON array.
Double check that each explanation matches its corresponding product.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const messageContent = response.content[0].type === 'text' 
      ? response.content[0].text 
      : ''

    try {
      // Clean up the response to ensure we only have JSON
      const cleanedContent = messageContent.trim()
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim()

      const results = JSON.parse(cleanedContent) as BatchMatchResult[]
      
      // Validate each result
      return results.filter(result => {
        // Ensure dealIndex is valid
        if (result.dealIndex < 0 || result.dealIndex >= deals.length) {
          console.error('Invalid deal index:', result)
          return false
        }
        
        // Verify explanation mentions the product
        const deal = deals[result.dealIndex]
        const productNameLower = deal.product_name.toLowerCase()
        const explanationLower = result.explanation.toLowerCase()
        
        if (!explanationLower.includes(productNameLower)) {
          console.error('Explanation does not match product:', {
            product: deal.product_name,
            explanation: result.explanation
          })
          return false
        }
        
        return true
      })
    } catch (error) {
      console.error('Error parsing batch results:', error)
      return []
    }
  } catch (error) {
    console.error('Error matching deal batch:', error)
    return []
  }
}

export async function findMatchingDeals(
  deals: Deal[],
  preferences: string[]
): Promise<Array<Deal & { confidence_score: number; matching_explanation: string }>> {
  const matchingDeals: Array<Deal & { confidence_score: number; matching_explanation: string }> = []
  const dealBatches: Deal[][] = []

  // Split deals into batches
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    dealBatches.push(deals.slice(i, i + BATCH_SIZE))
  }

  // Process batches with limited concurrency
  const batchResults: BatchMatchResult[] = []
  for (let i = 0; i < dealBatches.length; i += MAX_CONCURRENT_CALLS) {
    const currentBatches = dealBatches.slice(i, i + MAX_CONCURRENT_CALLS)
    const batchPromises = currentBatches.map((batch, batchIndex) => 
      matchDealBatch(
        batch, 
        preferences,
        (i + batchIndex) * BATCH_SIZE
      )
    )
    
    const results = await Promise.all(batchPromises)
    results.forEach((result, batchIndex) => {
      // Adjust deal indices based on batch position
      const batchOffset = (i + batchIndex) * BATCH_SIZE
      result.forEach(match => {
        const globalDealIndex = batchOffset + match.dealIndex
        // Verify the match corresponds to the correct deal
        const deal = deals[globalDealIndex]
        if (deal && match.explanation.toLowerCase().includes(deal.product_name.toLowerCase())) {
          batchResults.push({
            ...match,
            dealIndex: globalDealIndex
          })
        } else {
          console.error('Mismatched deal:', {
            deal: deal?.product_name,
            explanation: match.explanation
          })
        }
      })
    })
  }

  // Process batch results to find best matches
  const dealMatches = new Map<number, { confidence: number; explanation: string }>()
  
  batchResults.forEach(result => {
    const currentBest = dealMatches.get(result.dealIndex)
    if (!currentBest || result.confidence > currentBest.confidence) {
      dealMatches.set(result.dealIndex, {
        confidence: result.confidence,
        explanation: result.explanation
      })
    }
  })

  // Create final matched deals array
  dealMatches.forEach((match, dealIndex) => {
    const deal = deals[dealIndex]
    // Double check the match is valid
    if (match.confidence >= 50 && 
        deal && 
        match.explanation.toLowerCase().includes(deal.product_name.toLowerCase())) {
      matchingDeals.push({
        ...deal,
        confidence_score: match.confidence,
        matching_explanation: match.explanation
      })
    }
  })

  return matchingDeals
} 