import { chromium } from 'playwright'
import { Database } from '@/types/database.types'
import Anthropic from '@anthropic-ai/sdk'

type Deal = Omit<
  Database['public']['Tables']['matched_deals']['Insert'],
  'id' | 'scrape_id' | 'user_id' | 'confidence_score' | 'matching_explanation' | 'created_at'
>

const STORE_URL = 'https://www.wholefoodsmarket.com/sales-flyer?store-id=10238'

// List of patterns for scripts to block
const BLOCKED_PATTERNS = [
  /ue-instrumentation/,
  /sync\.min_TTH/,
  /async\.min_TTH/,
  /analytics/,
  /tracking/,
  /gtm/,
  /google-analytics/,
]

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

async function debugPageState(page: any, step: string) {
  console.log('\n')
  console.log('🔍'.padEnd(50, '='))
  console.log(`DEBUG INFO FOR STEP: ${step}`)
  console.log('🔍'.padEnd(50, '='))
  
  try {
    // Log page title
    const title = await page.title()
    console.log('\n📄 Page Title:', title)

    // Log URL
    const url = page.url()
    console.log('🌐 Current URL:', url)

    // Take a screenshot
    const screenshotPath = `debug-${step.replace(/\s+/g, '-')}.png`
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    })
    console.log('📸 Screenshot saved:', screenshotPath)

    // Log all available elements
    console.log('\n📊 PAGE STRUCTURE:')
    const pageStructure = await page.evaluate(() => {
      const body = document.body
      const elements = {
        body: {
          children: Array.from(body.children).map(child => ({
            tag: child.tagName.toLowerCase(),
            id: child.id,
            classes: child.className,
          })),
        },
        mainElement: !!document.querySelector('main'),
        gridElements: Array.from(document.querySelectorAll('.grid')).map(grid => ({
          classes: grid.className,
          childCount: grid.children.length,
        })),
        visibleText: Array.from(document.querySelectorAll('h1, h2, h3, p'))
          .map(el => el.textContent?.trim())
          .filter(Boolean)
          .slice(0, 5),
      }
      return JSON.stringify(elements, null, 2)
    })
    console.log(pageStructure)

  } catch (error) {
    console.log('❌ Error during debug:', error)
  }
  
  console.log('\n' + '🔍'.padEnd(50, '=') + '\n')
}

async function parseHTMLWithAI(html: string): Promise<Deal | null> {
  console.log('🤖 Sending HTML to Claude for parsing...')
  
  const prompt = `You are parsing HTML from a Whole Foods product item to extract deal information.
Analyze this single product HTML and return a JSON object with the following structure:
{
  "product_name": string,        // Required: Name of the product
  "product_description": string, // Optional: Description if available
  "sale_price": number,         // Required: Current sale price
  "regular_price": number,      // Required: Original price
  "discount_percentage": number, // Required: Calculated discount
  "image_url": string,          // Required: URL of product image
  "product_url": string         // Required: URL to product page
}

IMPORTANT: Return ONLY a valid JSON object. Do not include any additional text, explanations, or markdown formatting.
The response should start with '{' and end with '}'.

Requirements:
1. Only return data if you are confident you have identified a grocery item with price and name
2. Ensure sale_price and regular_price are numbers (not strings)
3. Calculate discount_percentage as ((regular_price - sale_price) / regular_price) * 100
4. Ensure image_url and product_url are complete URLs (not relative paths)
5. Return null if data is incomplete or uncertain

Example response format:
{
  "product_name": "Organic Bananas",
  "product_description": "Fresh organic bananas from Ecuador",
  "sale_price": 2.99,
  "regular_price": 4.99,
  "discount_percentage": 40.08,
  "image_url": "https://...",
  "product_url": "https://..."
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0,
      messages: [
        { 
          role: 'user', 
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'text',
              text: `Here's the HTML content of the product item to parse:\n${html}`
            }
          ]
        }
      ],
    })

    const messageContent = response.content[0].type === 'text' 
      ? response.content[0].text 
      : ''

    try {
      // Clean up the response to ensure we only have JSON
      const cleanedContent = messageContent.trim()
        .replace(/^```json\s*/, '') // Remove leading markdown
        .replace(/\s*```$/, '')     // Remove trailing markdown
        .trim()

      // Try to parse the cleaned content
      try {
        const deal = JSON.parse(cleanedContent) as Deal
        
        // Validate the deal
        const isValid = 
          deal.product_name &&
          typeof deal.sale_price === 'number' &&
          typeof deal.regular_price === 'number' &&
          typeof deal.discount_percentage === 'number' &&
          deal.image_url &&
          deal.product_url

        if (!isValid) {
          console.log('⚠️ Invalid deal data:', deal)
          return null
        }

        return deal
      } catch (parseError) {
        console.error('❌ JSON parse failed:', parseError)
        return null
      }

    } catch (error) {
      console.error('❌ Error parsing Claude response:', error)
      console.error('Full response was:', messageContent)
      return null
    }

  } catch (error) {
    console.error('❌ Error calling Claude API:', error)
    return null
  }
}

export async function scrapeWholeFoods(): Promise<Deal[]> {
  const browser = await chromium.launch({
    headless: true,
  })
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()
  
  try {
    console.log('\n🚀 Starting scraper...')
    console.log('🌐 Navigating to Whole Foods page...')
    
    await page.goto(STORE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Wait for page to load
    console.log('⏳ Waiting 5 seconds for page to load...')
    await page.waitForTimeout(5000)

    // Extract product items
    console.log('📄 Extracting product items...')
    const productItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.col-span-1'))
      
      if (items.length === 0) {
        console.log('No product items found')
        return null
      }

      console.log(`Found ${items.length} product items`)
      return items.map(item => item.outerHTML)
    })
    
    if (!productItems || productItems.length === 0) {
      throw new Error('Failed to find product items')
    }

    console.log(`📊 Found ${productItems.length} product items`)

    // Process each item individually
    console.log('🔄 Processing items...')
    const deals: Deal[] = []
    
    for (let i = 0; i < productItems.length; i++) {
      console.log(`\n📦 Processing item ${i + 1} of ${productItems.length}`)
      const deal = await parseHTMLWithAI(productItems[i])
      if (deal) {
        deals.push(deal)
        console.log('✅ Successfully parsed deal:', deal.product_name)
      }
    }

    if (deals.length === 0) {
      throw new Error('No valid deals found in parsed data')
    }

    console.log(`\n🎉 Successfully parsed ${deals.length} deals`)
    return deals

  } catch (error) {
    console.error('❌ Scraping error:', error)
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true })
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
} 