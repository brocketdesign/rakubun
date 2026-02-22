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
  documentation: {
    title: 'Documentation',
    subtitle: 'Learn how to connect your WordPress site and get started with RakuBun.',
    backToDashboard: 'Back to Dashboard',
    connectSection: {
      title: 'How to Connect Your WordPress Site',
      intro: 'RakuBun connects to your WordPress site using the REST API and Application Passwords. This allows RakuBun to securely publish articles, manage categories, and upload images to your site without requiring your main WordPress password.',
      requirements: {
        title: 'Requirements',
        items: [
          'A self-hosted WordPress site (WordPress.org), version 5.6 or later',
          'Administrator access to your WordPress dashboard',
          'HTTPS enabled on your site (required for Application Passwords)',
          'WordPress REST API enabled (enabled by default)',
        ],
      },
      steps: {
        title: 'Connection Steps',
        items: [
          {
            title: 'Step 1: Prepare your WordPress site',
            description: 'Make sure your WordPress site is running version 5.6 or later and that HTTPS is enabled. You can check your WordPress version in the Dashboard → Updates section.',
          },
          {
            title: 'Step 2: Generate an Application Password',
            description: 'Follow the instructions in the "How to Get an Application Password" section below to create a dedicated password for RakuBun.',
          },
          {
            title: 'Step 3: Go to Sites page in RakuBun',
            description: 'Navigate to the Sites page in your RakuBun dashboard and click "Add Site".',
          },
          {
            title: 'Step 4: Enter your site details',
            description: 'Enter your site name, WordPress URL (e.g., https://yourdomain.com), your WordPress username, and the Application Password you generated.',
          },
          {
            title: 'Step 5: Connect and verify',
            description: 'Click "Connect Site". RakuBun will validate the connection, verify REST API access, and map your categories. You\'ll see a green "Connected" status when everything is working.',
          },
        ],
      },
    },
    appPasswordSection: {
      title: 'How to Get an Application Password',
      intro: 'Application Passwords are a feature built into WordPress (since version 5.6) that allow external applications like RakuBun to authenticate without using your main WordPress password.',
      whatIs: {
        title: 'What is an Application Password?',
        description: 'An Application Password is a separate, revocable password specifically designed for API access. It is different from your regular WordPress login password. You can create multiple Application Passwords for different services and revoke them individually at any time without affecting your main login.',
      },
      steps: {
        title: 'Step-by-Step Instructions',
        items: [
          {
            title: 'Step 1: Log in to WordPress',
            description: 'Log in to your WordPress admin dashboard (usually at yourdomain.com/wp-admin).',
          },
          {
            title: 'Step 2: Go to your Profile',
            description: 'Navigate to Users → Profile from the left sidebar, or click on your name in the top-right corner and select "Edit Profile".',
          },
          {
            title: 'Step 3: Scroll to Application Passwords',
            description: 'Scroll down to the "Application Passwords" section at the bottom of your profile page. If you don\'t see this section, make sure your site has HTTPS enabled and is running WordPress 5.6+.',
          },
          {
            title: 'Step 4: Enter Application Name',
            description: 'In the "New Application Password Name" field, type "RakuBun" (or any name you prefer to identify this connection).',
          },
          {
            title: 'Step 5: Generate the Password',
            description: 'Click the "Add New Application Password" button. WordPress will generate a password that looks like: xxxx xxxx xxxx xxxx xxxx xxxx.',
          },
          {
            title: 'Step 6: Copy the Password',
            description: 'IMPORTANT: Copy this password immediately and save it somewhere safe. WordPress will only show it once. If you lose it, you\'ll need to generate a new one.',
          },
          {
            title: 'Step 7: Paste into RakuBun',
            description: 'Go back to RakuBun, paste the Application Password into the connection form, and click "Connect Site".',
          },
        ],
      },
      tips: {
        title: 'Important Tips',
        items: [
          'The password is shown only once — copy it immediately after generation.',
          'Application Passwords include spaces — paste it exactly as WordPress shows it.',
          'You can revoke the password anytime from your WordPress profile without affecting other passwords.',
          'Use a descriptive name like "RakuBun" so you can easily identify it later.',
          'If your site uses a security plugin, make sure it doesn\'t block the REST API or Application Passwords.',
        ],
      },
    },
    troubleshooting: {
      title: 'Troubleshooting',
      items: [
        {
          question: 'I don\'t see the Application Passwords section',
          answer: 'Application Passwords require WordPress 5.6+ and HTTPS. Make sure both requirements are met. Some security plugins may also hide this section — check your plugin settings.',
        },
        {
          question: 'Connection fails with "Unauthorized" error',
          answer: 'Double-check your username and Application Password. Make sure there are no extra spaces before or after the password. Also verify that the username matches the account that generated the password.',
        },
        {
          question: 'Connection fails with "REST API disabled" error',
          answer: 'Some security plugins or custom configurations disable the WordPress REST API. Check your security plugin settings and make sure the REST API is enabled.',
        },
        {
          question: 'I lost my Application Password',
          answer: 'You cannot view an Application Password once it\'s been generated. Simply create a new one from your WordPress profile and revoke the old one.',
        },
      ],
    },
    needHelp: {
      title: 'Need Help?',
      description: 'If you\'re still having trouble connecting your WordPress site, our support team is here to help.',
      cta: 'Contact Support',
    },
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
