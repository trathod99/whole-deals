# Whole Foods Deals

A personalized web application that scrapes Whole Foods' weekly deals and notifies users about products matching their food preferences.

## Features

- 🔐 Google OAuth authentication
- 🛍️ Automated Whole Foods deal scraping
- 🤖 AI-powered preference matching using Claude
- 📧 Weekly personalized email notifications
- 🎯 Custom food preference management

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **UI Components**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **AI**: Claude API
- **Email**: Resend
- **Scraping**: Puppeteer
- **Deployment**: Vercel

## Prerequisites

Before you begin, ensure you have:

1. Node.js 18+ installed
2. A Supabase account and project
3. A Google Cloud Console project with OAuth configured
4. An Anthropic account for Claude API access
5. A Resend account for email sending

## Environment Variables

Create a `.env.local` file with the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
ANTHROPIC_API_KEY=your_claude_api_key
RESEND_API_KEY=your_resend_api_key
```

## Database Setup

1. Create a new Supabase project
2. Run the following SQL in the Supabase SQL editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Scrape history table
CREATE TABLE scrape_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  successful BOOLEAN NOT NULL,
  error_message TEXT,
  data JSONB
);

-- Matched deals table
CREATE TABLE matched_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scrape_id UUID NOT NULL REFERENCES scrape_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_description TEXT,
  sale_price DECIMAL(10,2) NOT NULL,
  regular_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  product_url TEXT,
  confidence_score INTEGER NOT NULL,
  matching_explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_matched_deals_user_id ON matched_deals(user_id);
CREATE INDEX idx_matched_deals_scrape_id ON matched_deals(scrape_id);
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whole-foods-deals.git
cd whole-foods-deals
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

1. Create a new project on Vercel
2. Connect your repository
3. Add the environment variables
4. Deploy!

The cron job for scraping will automatically run every Wednesday at 9am PT.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
