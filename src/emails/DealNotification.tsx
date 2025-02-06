import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { Product } from '@/types/scraper.types'

interface DealNotificationProps {
  deals: Product[]
  userEmail: string
}

export default function DealNotification({ deals, userEmail }: DealNotificationProps) {
  // Group deals by category
  const dealsByCategory = deals.reduce((acc, deal) => {
    const category = deal.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(deal)
    return acc
  }, {} as Record<string, Product[]>)

  return (
    <Html>
      <Head />
      <Preview>Your personalized Whole Foods deals for this week</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Whole Foods Deals</Heading>
          <Text style={text}>
            Hi {userEmail}, we found {deals.length} deals matching your preferences!
          </Text>

          {Object.entries(dealsByCategory).map(([category, categoryDeals]) => (
            <Section key={category} style={section}>
              <Heading style={h2}>{category}</Heading>
              {categoryDeals.map((deal) => (
                <Section key={deal.name} style={dealContainer}>
                  <div style={dealGrid}>
                    {deal.imageUrl && (
                      <Img
                        src={deal.imageUrl}
                        alt={deal.name}
                        width={100}
                        height={100}
                        style={productImage}
                      />
                    )}
                    <div style={dealInfo}>
                      <Text style={productName}>{deal.name}</Text>
                      {deal.description && (
                        <Text style={description}>{deal.description}</Text>
                      )}
                      <Text style={price}>
                        Sale: ${deal.salePrice.toFixed(2)}{' '}
                        <span style={regularPrice}>
                          Regular: ${deal.regularPrice.toFixed(2)}
                        </span>
                      </Text>
                      <Text style={discount}>
                        Save {deal.discountPercentage.toFixed(0)}%
                      </Text>
                      {deal.productUrl && (
                        <Link style={link} href={deal.productUrl}>
                          View Details →
                        </Link>
                      )}
                    </div>
                  </div>
                </Section>
              ))}
            </Section>
          ))}
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
}

const section = {
  padding: '24px',
  borderBottom: '1px solid #e6ebf1',
}

const h1 = {
  color: '#484848',
  fontSize: '36px',
  fontWeight: '700',
  margin: '30px 0',
  padding: '0',
  textAlign: 'center' as const,
}

const h2 = {
  color: '#484848',
  fontSize: '24px',
  fontWeight: '600',
  margin: '16px 0',
}

const text = {
  color: '#484848',
  fontSize: '16px',
  margin: '24px 0',
}

const dealContainer = {
  padding: '16px',
  marginBottom: '16px',
  backgroundColor: '#f8fafc',
  borderRadius: '8px',
}

const dealGrid = {
  display: 'flex' as const,
  gap: '16px',
}

const dealInfo = {
  flex: '1',
}

const productImage = {
  borderRadius: '4px',
  objectFit: 'cover' as const,
}

const productName = {
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px',
  color: '#1a1a1a',
}

const description = {
  fontSize: '14px',
  color: '#666666',
  margin: '0 0 8px',
}

const price = {
  fontSize: '16px',
  fontWeight: '600',
  color: '#059669',
  margin: '0 0 4px',
}

const regularPrice = {
  color: '#6b7280',
  textDecoration: 'line-through',
  marginLeft: '8px',
  fontWeight: '400',
}

const discount = {
  fontSize: '14px',
  color: '#dc2626',
  fontWeight: '600',
  margin: '0 0 8px',
}

const link = {
  color: '#0284c7',
  fontSize: '14px',
  textDecoration: 'none',
} 