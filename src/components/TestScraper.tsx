'use client'

import { useState } from 'react'

interface Deal {
  product_name: string
  product_description: string
  sale_price: number
  regular_price: number
  discount_percentage: number
  category: string
  image_url: string
  product_url: string
}

interface MatchedDeal extends Deal {
  confidence_score: number
  matching_explanation: string
}

interface ScrapeResult {
  success: boolean
  scrapeId: string
  dealsCount: number
  deals: Deal[]
  matchedDeals: MatchedDeal[]
  preferences: string[]
}

export default function TestScraper() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [showAllDeals, setShowAllDeals] = useState(false)
  const [showMatches, setShowMatches] = useState(true)

  const handleTestScrape = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/test-scrape')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape deals')
      }

      setResult(data)
    } catch (error) {
      console.error('Error testing scraper:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Test Scraper</h2>
        <button
          onClick={handleTestScrape}
          disabled={isLoading}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Scraping...' : 'Test Scrape'}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-md bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold leading-6 text-gray-900">
                Scrape Results
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Found {result.dealsCount} total deals
              </p>
              {result.matchedDeals.length > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  {result.matchedDeals.length} deals match your preferences
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500">
                Scrape ID: {result.scrapeId}
              </p>
              {result.preferences.length > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  Your preferences: {result.preferences.join(', ')}
                </p>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setShowMatches(!showMatches)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {showMatches ? 'Hide Matched Deals' : 'Show Matched Deals'}
                </button>
                <button
                  onClick={() => setShowAllDeals(!showAllDeals)}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  {showAllDeals ? 'Hide All Deals' : 'Show All Deals'}
                </button>
              </div>

              {showMatches && result.matchedDeals.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Matched Deals
                  </h4>
                  <div className="space-y-4">
                    {result.matchedDeals.map((deal, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-green-200 bg-green-50 p-4"
                      >
                        <div className="flex items-start gap-4">
                          {deal.image_url && (
                            <img
                              src={deal.image_url}
                              alt={deal.product_name}
                              className="h-20 w-20 rounded-md object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {deal.product_name}
                            </h4>
                            {deal.product_description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {deal.product_description}
                              </p>
                            )}
                            <div className="mt-2 text-sm">
                              <span className="font-medium text-green-600">
                                ${deal.sale_price.toFixed(2)}
                              </span>
                              <span className="ml-2 text-gray-500 line-through">
                                ${deal.regular_price.toFixed(2)}
                              </span>
                              <span className="ml-2 text-green-600">
                                Save {deal.discount_percentage.toFixed(0)}%
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-gray-500">
                              Category: {deal.category}
                            </div>
                            <div className="mt-2 text-sm">
                              <span className="font-medium text-blue-600">
                                Match Confidence: {deal.confidence_score}%
                              </span>
                              <p className="mt-1 text-gray-600 italic">
                                {deal.matching_explanation}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showAllDeals && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    All Deals
                  </h4>
                  <div className="mt-4 space-y-4">
                    {result.deals.map((deal, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-gray-200 p-4"
                      >
                        <div className="flex items-start gap-4">
                          {deal.image_url && (
                            <img
                              src={deal.image_url}
                              alt={deal.product_name}
                              className="h-20 w-20 rounded-md object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {deal.product_name}
                            </h4>
                            {deal.product_description && (
                              <p className="mt-1 text-sm text-gray-500">
                                {deal.product_description}
                              </p>
                            )}
                            <div className="mt-2 text-sm">
                              <span className="font-medium text-green-600">
                                ${deal.sale_price.toFixed(2)}
                              </span>
                              <span className="ml-2 text-gray-500 line-through">
                                ${deal.regular_price.toFixed(2)}
                              </span>
                              <span className="ml-2 text-green-600">
                                Save {deal.discount_percentage.toFixed(0)}%
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-gray-500">
                              Category: {deal.category}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 