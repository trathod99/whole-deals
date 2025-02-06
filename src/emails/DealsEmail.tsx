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
import { Database } from '@/types/database.types'

type Deal = Database['public']['Tables']['matched_deals']['Row']

interface DealsEmailProps {
  deals: Deal[]
  preferences: string[]
}

export default function DealsEmail({ deals, preferences }: DealsEmailProps) {
  // Group deals by category
  const dealsByCategory = deals.reduce((acc, deal) => {
    const category = deal.category || 'Uncategorized'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(deal)
    return acc
  }, {} as Record<string, Deal[]>)

  return (
    <Html>
      <Head />
      <Preview>Found {deals.length} Whole Foods deals matching your preferences</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Personalized Whole Foods Deals</Heading>
          
          <Text style={text}>
            Based on your preferences: {preferences.join(', ')}
          </Text>
          
          <Text style={text}>
            We found {deals.length} deals that match your preferences this week.
          </Text>

          {Object.entries(dealsByCategory).map(([category, categoryDeals]) => (
            <Section key={category} style={section}>
              <Heading style={h2}>{category}</Heading>
              
              {categoryDeals.map((deal) => (
                <Section key={deal.id} style={dealContainer}>
                  <div style={dealGrid}>
                    {deal.image_url && (
                      <Img
                        src={deal.image_url}
                        alt={deal.product_name}
                        width={100}
                        height={100}
                        style={productImage}
                      />
                    )}
                    
                    <div style={dealInfo}>
                      <Text style={productName}>
                        <Link href={deal.product_url} style={link}>
                          {deal.product_name}
                        </Link>
                      </Text>
                      
                      {deal.product_description && (
                        <Text style={description}>
                          {deal.product_description}
                        </Text>
                      )}
                      
                      <Text style={priceInfo}>
                        Sale: ${deal.sale_price.toFixed(2)} 
                        <span style={regularPrice}>
                          Regular: ${deal.regular_price.toFixed(2)}
                        </span>
                        <span style={discount}>
                          Save {deal.discount_percentage.toFixed(0)}%
                        </span>
                      </Text>
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
  color: '#000',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '32px',
  margin: '16px 0',
  padding: '0 24px',
}

const h2 = {
  color: '#525f7f',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '28px',
  margin: '16px 0',
}

const text = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  padding: '0 24px',
}

const dealContainer = {
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#f8fafc',
  margin: '16px 0',
}

const dealGrid = {
  display: 'flex',
  gap: '16px',
}

const productImage = {
  borderRadius: '4px',
  objectFit: 'cover' as const,
}

const dealInfo = {
  flex: '1',
}

const productName = {
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 8px',
  color: '#000',
}

const description = {
  fontSize: '14px',
  color: '#525f7f',
  margin: '0 0 8px',
}

const priceInfo = {
  fontSize: '14px',
  color: '#000',
  margin: '0',
}

const regularPrice = {
  color: '#525f7f',
  marginLeft: '12px',
  textDecoration: 'line-through',
}

const discount = {
  color: '#10b981',
  marginLeft: '12px',
  fontWeight: '600',
}

const link = {
  color: '#000',
  textDecoration: 'none',
} 