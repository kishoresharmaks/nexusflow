export interface PlanEntitlements {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  maxMonthlyPosts: number;
  maxMonthlyAiWords: number;
  maxSocialAccounts: number;
  maxTeamMembers: number;
  features: string[];
}

export const BILLING_PLANS: Record<string, PlanEntitlements> = {
  FREE: {
    id: 'FREE',
    name: 'Free Trial',
    description: 'Perfect for evaluating NexusFlow with your initial catalog.',
    priceCents: 0,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 10,
    maxMonthlyAiWords: 5000,
    maxSocialAccounts: 1,
    maxTeamMembers: 1,
    features: [
      'Single channel publishing',
      'Basic catalog import',
      '5,000 AI words/month',
      'Human review workflow',
    ],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter Merchant',
    description: 'Essential multi-channel publishing for emerging ecommerce stores.',
    priceCents: 2900,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 50,
    maxMonthlyAiWords: 50000,
    maxSocialAccounts: 3,
    maxTeamMembers: 3,
    features: [
      'Up to 3 connected social channels',
      '50 scheduled posts/month',
      '50,000 grounded AI words/month',
      'Brand voice customization',
      'CSV catalog sync',
      'Email support',
    ],
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Growth Brand',
    description: 'High-volume content automation with approval chains and analytics.',
    priceCents: 7900,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 200,
    maxMonthlyAiWords: 200000,
    maxSocialAccounts: 10,
    maxTeamMembers: 10,
    features: [
      'Up to 10 connected social channels',
      '200 scheduled posts/month',
      '200,000 grounded AI words/month',
      'Multi-tier review & approval policies',
      'Private S3 media library',
      'Priority publishing queue',
      'Dedicated account support',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Scale & Agency',
    description: 'Uncapped marketing automation for multi-brand agencies and top retailers.',
    priceCents: 19900,
    currency: 'USD',
    billingInterval: 'month',
    maxMonthlyPosts: 1000,
    maxMonthlyAiWords: 1000000,
    maxSocialAccounts: 25,
    maxTeamMembers: 50,
    features: [
      'Up to 25 connected social channels',
      '1,000 scheduled posts/month',
      '1,000,000 AI words/month',
      'Custom webhook triggers',
      'Multi-workspace agency management',
      'SLA-backed publishing delivery',
      '24/7 dedicated support',
    ],
  },
};
