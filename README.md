# Rakubun

> Your blog, on autopilot.

Rakubun is an AI-powered platform that analyzes your WordPress site, researches trending topics, and publishes optimized articles while you focus on growth. It learns your style, tone, and structure to build a content plan that feels like you wrote it.

## Features

- **One-click WordPress Sync**: Connect your site securely using Application Passwords.
- **AI Site Analysis**: Maps your tone, structure, and content gaps.
- **Trending Topics Research**: Suggests angles with the best chance to rank based on real search data.
- **Auto-Publishing**: Schedule once, publish forever. Generates, formats, and publishes to WordPress with images, headings, and SEO meta included.
- **Monetization Dashboard**: Track your estimated monthly revenue and performance.
- **Multilingual Support**: Available in English and Japanese.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, GSAP (for animations)
- **Backend**: Node.js (Vercel Serverless Functions), MongoDB
- **Authentication**: Clerk
- **Routing**: React Router v7

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB database
- Clerk account for authentication
- A WordPress site (for testing the publishing features)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/rakubun.git
   cd rakubun
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables:
   ```env
   # Frontend (Vite)
   VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

   # Backend (Vercel/Node)
   CLERK_SECRET_KEY=your_clerk_secret_key
   MONGODB_URL=your_mongodb_connection_string
   MONGODB_DATABASE=rakubun # Optional, defaults to 'rakubun'
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`.

## Project Structure

- `api/`: Vercel Serverless Functions (Backend API)
- `src/`: Frontend React application
  - `components/`: Reusable UI components (including shadcn/ui)
  - `hooks/`: Custom React hooks
  - `i18n/`: Internationalization files (English and Japanese)
  - `layouts/`: Page layouts (e.g., DashboardLayout)
  - `lib/`: Utility functions and API clients
  - `pages/`: Application pages (Landing, Dashboard, etc.)
  - `sections/`: Landing page sections
  - `stores/`: State management

## License

This project is private and confidential.
