import { chromium } from 'playwright'
import { Database } from '@/types/database.types'

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

export async function scrapeWholeFoods(): Promise<Deal[]> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
    ]
  })
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    deviceScaleFactor: 2,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
  })

  const page = await context.newPage()
  
  try {
    console.log('\n🚀 Starting scraper...')
    
    // Only block specific scripts that are causing issues
    await page.route('**/*', async (route) => {
      const url = route.request().url()
      const resourceType = route.request().resourceType()
      
      // Block problematic scripts
      if (resourceType === 'script' && BLOCKED_PATTERNS.some(pattern => pattern.test(url))) {
        console.log('🚫 Blocking script:', url)
        await route.abort()
        return
      }

      // Allow all other resources
      await route.continue()
    })

    console.log('🌐 Navigating to Whole Foods page...')
    await page.goto(STORE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Debug immediately after navigation
    await debugPageState(page, 'initial-load')

    // Wait for any content to load
    console.log('⏳ Waiting for page content...')
    await page.waitForTimeout(5000) // Give the page some time to load
    await debugPageState(page, 'after-wait')

    // Try different selectors
    console.log('🔍 Looking for content...')
    const selectors = ['main', '#main', '#root', '#__next', '.grid']
    for (const selector of selectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 5000 })
        if (element) {
          console.log(`✅ Found element: ${selector}`)
          break
        }
      } catch (e) {
        console.log(`❌ Selector not found: ${selector}`)
      }
    }

    // Wait for the main content with retry logic
    console.log('⏳ Waiting for main content...')
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      try {
        await debugPageState(page, `retry-${retryCount}-before`)
        
        // First wait for any grid to appear
        await page.waitForSelector('.grid', {
          state: 'visible',
          timeout: 20000,
        })
        
        await debugPageState(page, `retry-${retryCount}-after`)
        
        // Then look for the specific product grid
        const gridExists = await page.evaluate(() => {
          const grids = document.querySelectorAll('.grid')
          for (const grid of grids) {
            if (grid.classList.contains('grid-cols-4') || 
                grid.classList.contains('mobile:grid-cols-2')) {
              return true
            }
          }
          return false
        })

        if (gridExists) {
          console.log('✅ Found product grid!')
          break
        }

        throw new Error('Product grid not found')
      } catch (error) {
        retryCount++
        console.log(`⚠️ Retry ${retryCount}/${maxRetries} waiting for product grid...`)
        
        if (retryCount === maxRetries) {
          throw new Error('Failed to load product grid after multiple retries')
        }
        
        // Wait a bit before reloading
        await page.waitForTimeout(5000)
        
        // Reload the page if content doesn't appear
        await page.reload({
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })
      }
    }

    // Scroll to load all products with improved error handling
    console.log('Scrolling to load all products...')
    await page.evaluate(async () => {
      return new Promise<void>((resolve, reject) => {
        let totalHeight = 0
        const distance = 100
        const maxScrolls = 100 // Safety limit
        let scrollCount = 0
        
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance
          scrollCount++

          if (totalHeight >= scrollHeight || scrollCount >= maxScrolls) {
            clearInterval(timer)
            resolve()
          }
        }, 100)

        // Safety timeout
        setTimeout(() => {
          clearInterval(timer)
          resolve()
        }, 30000)
      })
    })

    await debugPageState(page, 'after-scroll')

    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(2000)

    console.log('Extracting deals...')
    const deals = await page.evaluate(() => {
      // Find the product grid using the actual classes
      const grid = Array.from(document.querySelectorAll('.grid')).find(el => 
        el.classList.contains('grid-cols-4') || 
        el.classList.contains('mobile:grid-cols-2')
      )
      
      if (!grid) {
        console.log('No product grid found')
        return []
      }

      const products = Array.from(grid.children)
      console.log('Found products:', products.length)
      
      return products.map((product) => {
        // Updated selectors based on actual page structure
        const nameEl = product.querySelector('h3, h4') // Assuming product titles are in headers
        const descEl = product.querySelector('p')
        const priceEls = product.querySelectorAll('.text-xl, .text-lg') // Assuming prices are in larger text
        const imageEl = product.querySelector('img')
        const linkEl = product.querySelector('a')

        const name = nameEl?.textContent?.trim() || ''
        const description = descEl?.textContent?.trim() || ''
        
        // Convert price text to numbers
        const prices = Array.from(priceEls).map(el => {
          const text = el.textContent || ''
          return parseFloat(text.replace(/[^0-9.]/g, '')) || 0
        }).sort((a, b) => a - b)
        
        const salePrice = prices[0] || 0
        const regularPrice = prices[1] || salePrice
        const discountPercentage = regularPrice ? ((regularPrice - salePrice) / regularPrice) * 100 : 0
        
        const imageUrl = imageEl?.getAttribute('src') || ''
        const productUrl = linkEl?.getAttribute('href') || ''

        return {
          product_name: name,
          product_description: description,
          sale_price: salePrice,
          regular_price: regularPrice,
          discount_percentage: Math.round(discountPercentage * 100) / 100,
          category: 'Uncategorized', // We'll need to find category information
          image_url: imageUrl,
          product_url: productUrl.startsWith('http') ? productUrl : `https://www.wholefoodsmarket.com${productUrl}`,
        }
      })
    })

    if (deals.length === 0) {
      await debugPageState(page, 'no-deals-found')
      throw new Error('No deals found - page may not have loaded correctly')
    }

    console.log(`✅ Found ${deals.length} deals`)
    return deals
  } catch (error) {
    console.error('❌ Scraping error:', error)
    await debugPageState(page, 'error-state')
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
} 