import type { Translations } from './types';

export const en: Translations = {
  nav: {
    product: 'Product',
    features: 'Features',
    pricing: 'Pricing',
    docs: 'Docs',
    startFree: 'Start free',
  },
  hero: {
    headline: 'Your blog, on autopilot.',
    description:
      'RakuBun analyzes your site, researches what\'s trending, and publishes optimized articles while you focus on growth.',
    ctaPrimary: 'Connect WordPress',
    ctaSecondary: 'See the dashboard',
    badgeFree: 'Free for 5 posts/mo',
    badgeNoCreditCard: 'No credit card',
    siteConnected: 'Site connected',
  },
  connect: {
    eyebrow: 'Setup',
    headline: 'One-click WordPress sync.',
    description:
      'Paste your Application Password. RakuBun validates the REST API, maps your categories, and starts listening.',
    link: 'How to create an app password',
    connectWordPress: 'Connect WordPress',
    siteUrl: 'Site URL',
    applicationPassword: 'Application Password',
    connectSite: 'Connect Site',
    encryptedSecure: 'Encrypted & secure',
  },
  analysis: {
    eyebrow: 'AI Analysis',
    headline: 'It learns your site.',
    description:
      'RakuBun reads your style, tone, and structure—then builds a content plan that feels like you wrote it.',
    toneMatch: 'Tone match',
    structureMap: 'Structure map',
    gapDetection: 'Gap detection',
    analysisReport: 'Analysis Report',
    structure: 'Structure',
    seoScore: 'SEO score',
  },
  research: {
    eyebrow: 'Research',
    headline: 'Trending topics, delivered.',
    description:
      'RakuBun monitors search trends and news in your niche—then suggests angles with the best chance to rank.',
    link: 'See example topics',
    trendingInNiche: 'Trending in your niche',
    topics: [
      'SEO Trends 2024',
      'Content Strategy',
      'AI Writing',
      'WordPress Tips',
      'Blog Monetization',
    ],
    sources: 'Sources: Google Trends, News API, Reddit',
  },
  autoPublish: {
    eyebrow: 'Auto-Publish',
    headline: 'Schedule once. Publish forever.',
    description:
      'Set your cadence. RakuBun generates, formats, and publishes to WordPress—images, headings, and meta included.',
    autoImages: 'Auto-images',
    internalLinks: 'Internal links',
    seoMeta: 'SEO meta',
    publishingSchedule: 'Publishing Schedule',
    calendarMonth: 'January 2025',
    calendarDays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    nextSchedule: 'Next: Monday 08:00',
    nextArticle: '"SEO Trends 2025"',
  },
  monetize: {
    eyebrow: 'Monetize',
    headline: 'Built to earn.',
    description:
      'Ad-ready layouts, fast performance, and revenue-share options—so your content pays for itself.',
    link: 'Explore monetization',
    revenueDashboard: 'Revenue Dashboard',
    weekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    estimatedMonthly: 'Estimated monthly',
  },
  features: {
    headline: 'Everything you need to run a blog',
    description:
      'From first draft to published post—RakuBun handles the busywork.',
    items: [
      {
        title: 'AI Site Analysis',
        description: 'Maps your tone, structure, and gaps.',
      },
      {
        title: 'Trending Topics',
        description: 'Suggestions based on real search data.',
      },
      {
        title: 'One-Click Publish',
        description: 'WordPress REST API, secured.',
      },
      {
        title: 'Smart Notifications',
        description: 'Email + push when posts go live.',
      },
      {
        title: 'Image Generation',
        description: 'GrokImaging integration included.',
      },
      {
        title: 'API Access',
        description: 'Build workflows with our REST API.',
      },
    ],
  },
  testimonials: {
    headline: 'Loved by creators',
    items: [
      {
        quote:
          'I went from 2 posts a month to 2 posts a week without hiring. RakuBun has completely transformed my content strategy.',
        name: 'Sarah Chen',
        role: 'Founder, TechBlog Daily',
      },
      {
        quote:
          'The AI actually sounds like me. My readers noticed the consistency and engagement has gone up 40%.',
        name: 'Michael Roberts',
        role: 'Indie Creator',
      },
      {
        quote:
          "Setup took 3 minutes. The first post ranked within a week. I've never seen results this fast.",
        name: 'Yuki Tanaka',
        role: 'SEO Consultant',
      },
    ],
  },
  pricing: {
    headline: 'Simple pricing',
    description: "Start free. Upgrade when you're ready to scale.",
    mostPopular: 'Most Popular',
    plans: [
      {
        name: 'Free',
        price: '$0',
        period: '/month',
        description: 'Perfect for getting started',
        features: [
          '5 articles/mo',
          '1 site',
          'Basic support',
          'Email notifications',
        ],
        cta: 'Start free',
      },
      {
        name: 'Pro',
        price: '$29',
        period: '/month',
        description: 'For serious content creators',
        features: [
          'Unlimited articles',
          '3 sites',
          'Priority support',
          'API access',
          'Image generation',
          'Advanced analytics',
        ],
        cta: 'Start Pro trial',
      },
      {
        name: 'Business',
        price: '$99',
        period: '/month',
        description: 'For teams and agencies',
        features: [
          'Unlimited everything',
          '10 sites',
          'Dedicated support',
          'Custom integrations',
          'White-label options',
          'Team collaboration',
        ],
        cta: 'Contact sales',
      },
    ],
  },
  footer: {
    headline: 'Start publishing today.',
    description: 'Free for 5 articles/month. No credit card required.',
    emailPlaceholder: 'you@company.com',
    getStarted: 'Get started',
    brandDescription: 'AI-powered auto-publishing for WordPress blogs.',
    copyright: '© {year} RakuBun. All rights reserved.',
    linkCategories: {
      product: 'Product',
      company: 'Company',
      legal: 'Legal',
    },
    links: {
      Product: ['Features', 'Pricing', 'API', 'Integrations'],
      Company: ['About', 'Blog', 'Careers', 'Press'],
      Legal: ['Privacy', 'Terms', 'Security', 'Cookies'],
    },
  },
};
