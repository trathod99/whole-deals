import { Anthropic } from '@anthropic-ai/sdk'
import { Database } from '@/types/database.types'

type Deal = Omit<
  Database['public']['Tables']['matched_deals']['Insert'],
  'id' | 'scrape_id' | 'user_id' | 'confidence_score' | 'matching_explanation' | 'created_at'
>

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const BATCH_SIZE = 10

async function checkExclusions(
  deals: Deal[],
  exclusions: string[]
): Promise<Map<number, string>> {
  const excludedDeals = new Map<number, string>()
  
  const prompt = `You are checking if food products contain specific ingredients or qualities that should exclude them.

Products to evaluate:
${deals.map((deal, i) => `${i + 1}. ${deal.product_name}${deal.product_description ? ` - ${deal.product_description}` : ''}`).join('\n')}

Items to exclude if found (check each product against ALL items):
${exclusions.map(ex => `- ${ex}`).join('\n')}

Instructions:
- Return ONLY products that DEFINITELY contain excluded items
- Require EXPLICIT evidence (ingredients, descriptions, categories)
- Do NOT exclude based on assumptions
- If unsure, do not exclude
- Return valid JSON only - no explanatory text or markdown

Return Format:
{
  "excluded_products": [
    {
      "index": product_number,
      "reason": "Clear explanation of why this product contains an excluded item"
    }
  ]
}

Only return products that you are VERY confident (90%+) contain excluded items.
Return ONLY the JSON object. No other text, no markdown formatting.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    let cleanedContent = ''
    
    try {
      // Clean the JSON string more aggressively
      cleanedContent = content
        .trim()
        // Remove any markdown code block syntax
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        // Remove any trailing commas before closing brackets
        .replace(/,(\s*[}\]])/g, '$1')
        // Remove any non-JSON text before or after the object
        .replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1')

      const result = JSON.parse(cleanedContent)
      
      if (!result.excluded_products || !Array.isArray(result.excluded_products)) {
        console.error('Invalid exclusion result format:', result)
        return excludedDeals
      }

      result.excluded_products.forEach((product: { index: number, reason: string }) => {
        if (typeof product.index === 'number' && 
            product.index > 0 && 
            product.index <= deals.length &&
            typeof product.reason === 'string') {
          excludedDeals.set(product.index - 1, product.reason)
        } else {
          console.error('Invalid excluded product format:', product)
        }
      })
    } catch (error) {
      console.error('Error parsing exclusion results:', error)
      console.error('Raw content:', content)
      console.error('Cleaned content:', cleanedContent)
    }
  } catch (error) {
    console.error('Error checking exclusions:', error)
  }

  return excludedDeals
}

async function findMatches(
  deals: Deal[],
  inclusions: string[]
): Promise<Map<number, { confidence: number; reason: string }>> {
  const matches = new Map<number, { confidence: number; reason: string }>()

  const prompt = `You are finding food products that match specific dietary preferences.

Products to evaluate:
${deals.map((deal, i) => `${i + 1}. ${deal.product_name}${deal.product_description ? ` - ${deal.product_description}` : ''}`).join('\n')}

Preferences to match (product must match AT LEAST ONE):
${inclusions.map(inc => `- ${inc}`).join('\n')}

Instructions:
- Find products that CLEARLY match at least one preference
- Require clear evidence from product name, description, or category
- Provide confidence score (0-100) for how well it matches
- Only include matches with 70%+ confidence
- Explain exactly why each product matches
- Return valid JSON only - no explanatory text or markdown

Return Format:
{
  "matches": [
    {
      "index": product_number,
      "confidence": confidence_score,
      "reason": "Clear explanation of how this product matches a preference"
    }
  ]
}

Return ONLY the JSON object. No other text, no markdown formatting.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    let cleanedContent = ''
    
    try {
      // Clean the JSON string more aggressively
      cleanedContent = content
        .trim()
        // Remove any markdown code block syntax
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        // Remove any trailing commas before closing brackets
        .replace(/,(\s*[}\]])/g, '$1')
        // Remove any non-JSON text before or after the object
        .replace(/^[^{]*({[\s\S]*})[^}]*$/, '$1')

      const result = JSON.parse(cleanedContent)
      
      if (!result.matches || !Array.isArray(result.matches)) {
        console.error('Invalid matches result format:', result)
        return matches
      }

      result.matches.forEach((match: { index: number, confidence: number, reason: string }) => {
        if (typeof match.index === 'number' && 
            match.index > 0 && 
            match.index <= deals.length &&
            typeof match.confidence === 'number' &&
            match.confidence >= 70 &&
            typeof match.reason === 'string') {
          matches.set(match.index - 1, {
            confidence: match.confidence,
            reason: match.reason
          })
        } else {
          console.error('Invalid match format:', match)
        }
      })
    } catch (error) {
      console.error('Error parsing match results:', error)
      console.error('Raw content:', content)
      console.error('Cleaned content:', cleanedContent)
    }
  } catch (error) {
    console.error('Error finding matches:', error)
  }

  return matches
}

export async function findMatchingDeals(
  deals: Deal[],
  preferenceTexts: string[]
): Promise<Array<Deal & { confidence_score: number; matching_explanation: string }>> {
  // Split preferences
  const exclusions = preferenceTexts
    .filter(p => p.toLowerCase().startsWith('no '))
    .map(p => p.slice(3))
  const inclusions = preferenceTexts
    .filter(p => !p.toLowerCase().startsWith('no '))

  const matchedDeals: Array<Deal & { confidence_score: number; matching_explanation: string }> = []

  // Process in batches
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = deals.slice(i, Math.min(i + BATCH_SIZE, deals.length))
    
    // 1. Check exclusions first
    const excludedIndices = await checkExclusions(batch, exclusions)
    console.log(`Batch ${i / BATCH_SIZE + 1}: Found ${excludedIndices.size} excluded items`)
    
    // 2. Find matches among non-excluded items
    const remainingDeals = batch.filter((_, index) => !excludedIndices.has(index))
    if (remainingDeals.length > 0) {
      const matches = await findMatches(remainingDeals, inclusions)
      console.log(`Batch ${i / BATCH_SIZE + 1}: Found ${matches.size} matching items`)

      // Add matches to final results
      remainingDeals.forEach((deal, index) => {
        const match = matches.get(index)
        if (match) {
          matchedDeals.push({
            ...deal,
            confidence_score: match.confidence,
            matching_explanation: match.reason
          })
        }
      })
    }
  }

  return matchedDeals
} 