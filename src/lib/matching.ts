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
const BATCH_SIZE = 5
const MAX_CONCURRENT_CALLS = 3

async function matchDealBatch(
  deals: Deal[],
  preferences: string[],
  batchStartIndex: number
): Promise<BatchMatchResult[]> {
  // Assign unique IDs to each product to ensure accurate matching
  const dealsWithIds = deals.map((deal, index) => ({
    ...deal,
    batchId: `PROD_${index + 1}` // e.g., PROD_1, PROD_2, etc.
  }))

  const prompt = `You are evaluating if products match specific food preferences.

Products:
${dealsWithIds.map(deal => `
${deal.batchId}:
Name: ${deal.product_name}
Description: ${deal.product_description || 'No description available'}
Category: ${deal.category}
`).join('\n')}

Preferences:
${preferences.map((pref, i) => `${i + 1}. ${pref}`).join('\n')}

For each product-preference combination that matches (confidence >= 50), create a JSON object with:
{
  "dealId": string,        // The PROD_X identifier
  "preferenceIndex": number,// 0-based index of the matching preference
  "confidence": number,    // 50-100 confidence score
  "explanation": string    // Explanation starting with the product name
}

IMPORTANT RULES:
1. Start each explanation with the EXACT product name
2. Only include matches with confidence >= 50
3. Explain specifically why THIS product matches THIS preference
4. Return a JSON array of matches

Example explanation format:
"[Product Name] matches the [preference] because [specific reason]"

Return ONLY a JSON array. No other text.`

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

      const results = JSON.parse(cleanedContent) as Array<{
        dealId: string
        preferenceIndex: number
        confidence: number
        explanation: string
      }>

      // Convert dealId (PROD_X) back to batch index and validate
      return results
        .map(result => {
          const batchIndex = parseInt(result.dealId.replace('PROD_', '')) - 1
          if (batchIndex < 0 || batchIndex >= deals.length) {
            console.error('Invalid batch index:', { result, batchIndex })
            return null
          }

          const deal = deals[batchIndex]
          if (!result.explanation.toLowerCase().startsWith(deal.product_name.toLowerCase())) {
            console.error('Explanation doesn\'t start with product name:', {
              product: deal.product_name,
              explanation: result.explanation
            })
            return null
          }

          return {
            dealIndex: batchIndex,
            preferenceIndex: result.preferenceIndex,
            confidence: result.confidence,
            explanation: result.explanation
          }
        })
        .filter((result): result is BatchMatchResult => result !== null)

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
      const batchOffset = (i + batchIndex) * BATCH_SIZE
      result.forEach(match => {
        const globalDealIndex = batchOffset + match.dealIndex
        const deal = deals[globalDealIndex]
        
        // Final validation before adding to results
        if (deal && match.explanation.toLowerCase().startsWith(deal.product_name.toLowerCase())) {
          batchResults.push({
            ...match,
            dealIndex: globalDealIndex
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
    if (deal) {
      matchingDeals.push({
        ...deal,
        confidence_score: match.confidence,
        matching_explanation: match.explanation
      })
    }
  })

  return matchingDeals
} 