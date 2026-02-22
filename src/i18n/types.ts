export type Language = 'en' | 'ja';

export interface Translations {
  nav: {
    product: string;
    features: string;
    pricing: string;
    docs: string;
    startFree: string;
  };
  hero: {
    headline: string;
    description: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badgeFree: string;
    badgeNoCreditCard: string;
    siteConnected: string;
  };
  connect: {
    eyebrow: string;
    headline: string;
    description: string;
    link: string;
    connectWordPress: string;
    siteUrl: string;
    applicationPassword: string;
    connectSite: string;
    encryptedSecure: string;
  };
  analysis: {
    eyebrow: string;
    headline: string;
    description: string;
    toneMatch: string;
    structureMap: string;
    gapDetection: string;
    analysisReport: string;
    structure: string;
    seoScore: string;
  };
  research: {
    eyebrow: string;
    headline: string;
    description: string;
    link: string;
    trendingInNiche: string;
    topics: string[];
    sources: string;
  };
  autoPublish: {
    eyebrow: string;
    headline: string;
    description: string;
    autoImages: string;
    internalLinks: string;
    seoMeta: string;
    publishingSchedule: string;
    calendarMonth: string;
    calendarDays: string[];
    nextSchedule: string;
    nextArticle: string;
  };
  monetize: {
    eyebrow: string;
    headline: string;
    description: string;
    link: string;
    revenueDashboard: string;
    weekDays: string[];
    estimatedMonthly: string;
  };
  features: {
    headline: string;
    description: string;
    items: {
      title: string;
      description: string;
    }[];
  };
  testimonials: {
    headline: string;
    items: {
      quote: string;
      name: string;
      role: string;
    }[];
  };
  pricing: {
    headline: string;
    description: string;
    mostPopular: string;
    plans: {
      name: string;
      price: string;
      period: string;
      description: string;
      features: string[];
      cta: string;
    }[];
  };
  documentation: {
    title: string;
    subtitle: string;
    backToDashboard: string;
    connectSection: {
      title: string;
      intro: string;
      requirements: {
        title: string;
        items: string[];
      };
      steps: {
        title: string;
        items: {
          title: string;
          description: string;
        }[];
      };
    };
    appPasswordSection: {
      title: string;
      intro: string;
      whatIs: {
        title: string;
        description: string;
      };
      steps: {
        title: string;
        items: {
          title: string;
          description: string;
        }[];
      };
      tips: {
        title: string;
        items: string[];
      };
    };
    troubleshooting: {
      title: string;
      items: {
        question: string;
        answer: string;
      }[];
    };
    apiSection: {
      title: string;
      intro: string;
      baseUrl: string;
      authentication: string;
      authDescription: string;
      endpoints: {
        title: string;
        method: string;
        path: string;
        description: string;
        responseExample: string;
      }[];
    };
    needHelp: {
      title: string;
      description: string;
      cta: string;
    };
  };
  footer: {
    headline: string;
    description: string;
    emailPlaceholder: string;
    getStarted: string;
    brandDescription: string;
    copyright: string;
    links: {
      [category: string]: string[];
    };
    linkCategories: {
      product: string;
      company: string;
      legal: string;
    };
  };
}
