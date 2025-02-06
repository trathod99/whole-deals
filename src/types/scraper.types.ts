export interface Product {
  name: string
  description: string
  salePrice: number
  regularPrice: number
  discountPercentage: number
  category: string
  imageUrl: string
  productUrl: string
}

export interface ScrapedData {
  products: Product[]
  scrapedAt: string
  storeLocation: string
}

export interface ScrapeError {
  message: string
  timestamp: string
  details?: unknown
} 