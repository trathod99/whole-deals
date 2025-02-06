import { Resend } from 'resend'
import { render } from '@react-email/render'
import DealNotification from '@/emails/DealNotification'
import type { Product } from '@/types/scraper.types'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendDealNotification(userEmail: string, deals: Product[]) {
  const emailHtml = render(DealNotification({ deals, userEmail }))

  try {
    await resend.emails.send({
      from: 'Whole Foods Deals <deals@wholefoodsdeals.com>',
      to: userEmail,
      subject: `Your Personalized Whole Foods Deals - ${deals.length} Matches Found!`,
      html: emailHtml,
    })
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
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