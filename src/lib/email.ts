import { Resend } from 'resend'
import { render } from '@react-email/render'
import DealsEmail from '@/emails/DealsEmail'
import { Database } from '@/types/database.types'

type BaseDeal = Omit<
  Database['public']['Tables']['matched_deals']['Insert'],
  'id' | 'scrape_id' | 'user_id' | 'created_at'
>

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendDealsEmail(
  to: string,
  deals: BaseDeal[],
  preferences: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Starting email send process...')
    console.log('Recipient:', to)
    console.log('Number of deals:', deals.length)
    console.log('Preferences:', preferences)

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing')
      throw new Error('RESEND_API_KEY is not configured')
    }
    console.log('RESEND_API_KEY is configured')

    // Validate email address
    if (!to || !to.includes('@')) {
      console.error('Invalid email:', to)
      throw new Error('Invalid email address')
    }

    // Validate deals and preferences
    if (!Array.isArray(deals) || !Array.isArray(preferences)) {
      console.error('Invalid data format:', { deals: Array.isArray(deals), preferences: Array.isArray(preferences) })
      throw new Error('Invalid deals or preferences format')
    }

    // Render email HTML
    console.log('Rendering email HTML...')
    const emailHtml = await render(
      DealsEmail({
        deals,
        preferences,
      })
    )
    console.log('Email HTML rendered successfully')

    // Send email
    console.log('Attempting to send email via Resend...')
    const { data, error } = await resend.emails.send({
      from: 'Whole Foods Deals <deals@resend.dev>',
      to,
      subject: `Found ${deals.length} Whole Foods deals matching your preferences`,
      html: emailHtml,
    })

    if (error) {
      console.error('Resend API error:', error)
      return { success: false, error: error.message }
    }

    console.log('Email sent successfully:', data)
    return { success: true }
  } catch (error) {
    console.error('Error in sendDealsEmail:', error)
    if (error instanceof Error) {
      console.error('Error stack:', error.stack)
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email'
    }
  }
}

export async function sendScrapeErrorNotification(adminEmail: string, error: Error) {
  try {
    await resend.emails.send({
      from: 'Whole Foods Deals <deals@wholefoodsdeals.com>',
      to: adminEmail,
      subject: 'Scraping Error Alert - Whole Foods Deals',
      html: `
        <h1>Scraping Error Alert</h1>
        <p>An error occurred while scraping Whole Foods deals:</p>
        <pre>${error.message}</pre>
        <p>Stack trace:</p>
        <pre>${error.stack}</pre>
      `,
    })
  } catch (error) {
    console.error('Error sending error notification:', error)
    throw error
  }
} 