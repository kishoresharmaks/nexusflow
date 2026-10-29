'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState, useEffect } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Database,
  ExternalLink,
  LineChart,
  PenSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { api, BillingPlanItem } from '../lib/api';

const workflow = [
  {
    title: 'Bring in your catalog',
    body: 'Import a CSV or connect an available store source. Review catalog freshness before using product details in a draft.',
    icon: Database,
  },
  {
    title: 'Create a grounded draft',
    body: 'Generate and edit content from the product facts available in your workspace—titles, prices, inventory, and brand context.',
    icon: PenSquare,
  },
  {
    title: 'Review before you publish',
    body: 'Use approvals and a visible post state to keep people in control. Channel publishing depends on verified provider access.',
    icon: ClipboardCheck,
  },
];

const capabilities = [
  'Catalog import, validation, and freshness timestamps',
  'Editable AI content drafts with product-fact grounding',
  'Approval policies, decision history, and publishing states',
  'UTM link creation and first-party click tracking',
];

const faqs = [
  {
    question: 'What can I use today?',
    answer:
      'You can manage a catalog, generate and edit grounded drafts, review content, and create campaign tracking links. Availability can vary by workspace configuration.',
  },
  {
    question: 'Does NexusFlow publish to every social network?',
    answer:
      'No. Social publishing is only available where the official provider API, account eligibility, permissions, and workspace configuration have been verified. Never assume a channel is connected until it is shown as connected in your workspace.',
  },
  {
    question: 'Are revenue and performance figures guaranteed?',
    answer:
      'No. Results depend on your store, channels, campaign, consent, and measurement configuration. NexusFlow reports data that is available; it does not forecast or guarantee returns.',
  },
  {
    question: 'How does catalog grounding prevent AI hallucinations?',
    answer:
      'The generation engine pulls strictly from your synced product facts—titles, prices, discounts, and inventory counts. If a product is out of stock or pricing data has aged past the configured freshness threshold, NexusFlow flags the item before generating drafts.',
  },
];

const architectureLedger = [
  {
    subsystem: 'Catalog Grounding Engine',
    code: 'SYS-CAT-01',
    guarantee: 'Real-time inventory verification & price truth binding',
    protocol: 'Freshness timestamp validation against synced store records',
    status: 'VERIFIED',
  },
  {
    subsystem: 'Security Vault',
    code: 'SYS-SEC-02',
    guarantee: 'Cryptographic social token protection at rest & in transit',
    protocol: 'Hardware envelope encryption (NIST SP 800-38D standard)',
    status: 'HARDENED',
  },
  {
    subsystem: 'Publishing Gateway',
    code: 'SYS-PUB-03',
    guarantee: 'Human-in-the-loop review policy enforcement',
    protocol: 'OAuth 2.0 PKCE with granular channel authorization scopes',
    status: 'ENFORCED',
  },
  {
    subsystem: 'Attribution Engine',
    code: 'SYS-ATR-04',
    guarantee: 'Deterministic first-party campaign attribution',
    protocol: 'HMAC-SHA256 signature verification & Redis deduplication',
    status: 'AUDITED',
  },
];

interface CanonicalPricingTier {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  postsLimit: number;
  aiWordsLimit: string;
  channelsLimit: number;
  seatsLimit: number;
  features: string[];
}

const DEFAULT_PLANS: CanonicalPricingTier[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'For boutique brands launching grounded content',
    monthlyPrice: 29,
    annualPrice: 23,
    postsLimit: 50,
    aiWordsLimit: '50,000',
    channelsLimit: 3,
    seatsLimit: 3,
    features: [
      '50 grounded posts / month',
      '50k words AI generation ceiling',
      '3 connected social accounts',
      '3 team member seats',
      'Catalog freshness validation',
      'Standard UTM campaign links',
    ],
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    tagline: 'For fast-moving ecommerce stores scaling reach',
    monthlyPrice: 79,
    annualPrice: 63,
    popular: true,
    postsLimit: 200,
    aiWordsLimit: '200,000',
    channelsLimit: 10,
    seatsLimit: 10,
    features: [
      '200 grounded posts / month',
      '200k words AI generation ceiling',
      '10 connected social accounts',
      '10 team member seats',
      'Multi-channel approval workflows',
      'Store webhook attribution tracking',
      'Audit logging & governance history',
    ],
  },
  {
    id: 'SCALE',
    name: 'Scale & Agency',
    tagline: 'For omnichannel brands and multi-client agencies',
    monthlyPrice: 199,
    annualPrice: 159,
    postsLimit: 1000,
    aiWordsLimit: '1,000,000',
    channelsLimit: 25,
    seatsLimit: 50,
    features: [
      '1,000 grounded posts / month',
      '1,000,000 words AI ceiling',
      '25 connected social accounts',
      '50 team member seats',
      'Dedicated SLA & token quotas',
      'Custom webhook signatures & HMAC',
      'Priority queue background processing',
    ],
  },
];

export interface LandingPageViewProps {
  onSwitchToV3?: () => void;
}

export function LandingPageView({ onSwitchToV3 }: LandingPageViewProps = {}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [livePlans, setLivePlans] = useState<BillingPlanItem[]>([]);
  const faqIds = [useId(), useId(), useId(), useId()];

  useEffect(() => {
    let isMounted = true;
    async function loadPublicPlans() {
      try {
        const fetched = await api.getPublicBillingPlans();
        if (isMounted && Array.isArray(fetched) && fetched.length > 0) {
          setLivePlans(fetched);
        }
      } catch {
        // Graceful fallback to DEFAULT_PLANS
      }
    }
    void loadPublicPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  // Map backend plans or fallback to canonical tiers
  const pricingTiers: CanonicalPricingTier[] = DEFAULT_PLANS.map((fallback) => {
    const matched = livePlans.find(
      (p) =>
        p.id.toUpperCase() === fallback.id.toUpperCase() ||
        (fallback.id === 'SCALE' && (p.id.toUpperCase() === 'PRO' || p.id.toUpperCase() === 'ENTERPRISE')),
    );
    if (!matched) return fallback;

    const monthlyPrice = Math.round(matched.priceCents / 100);
    const annualPrice = Math.round(monthlyPrice * 0.8);

    return {
      ...fallback,
      name: matched.name || fallback.name,
      tagline: matched.description || fallback.tagline,
      monthlyPrice,
      annualPrice,
      postsLimit: matched.maxMonthlyPosts ?? fallback.postsLimit,
      aiWordsLimit: matched.maxMonthlyAiWords ? matched.maxMonthlyAiWords.toLocaleString() : fallback.aiWordsLimit,
      channelsLimit: matched.maxSocialAccounts ?? fallback.channelsLimit,
      seatsLimit: matched.maxTeamMembers ?? fallback.seatsLimit,
      features: matched.features && matched.features.length > 0 ? matched.features : fallback.features,
    };
  });

  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-control bg-white px-4 py-3 text-sm font-bold text-[#17202A] shadow focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009]"
      >
        Skip to content
      </a>

      <main id="main-content" className="bg-[#F8FAFC] text-[#0F172A] selection:bg-orange-500/20 selection:text-orange-900">
        {/* Top Early Access Notice & UI Switcher */}
        <section className="border-b border-[#E2E8F0] bg-white px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-[#64748B]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <BadgeCheck aria-hidden="true" className="h-4 w-4 text-[#16803C]" />
              <span>Early access: use verified workspace capabilities; provider availability varies by account.</span>
              <Link
                href="#availability"
                className="font-semibold text-[#175CD3] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009] focus-visible:ring-offset-2"
              >
                What&apos;s available
              </Link>
            </div>
            {onSwitchToV3 && (
              <button
                type="button"
                onClick={onSwitchToV3}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white text-slate-900 px-3 py-1 font-semibold hover:bg-slate-100 transition-colors shadow-xs"
              >
                <span> Explore v3 Apple UI</span>
              </button>
            )}
          </div>
        </section>

        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div aria-hidden="true" className="absolute right-0 top-0 -z-0 h-96 w-96 rounded-full bg-orange-100/70 blur-3xl pointer-events-none" />
          <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#B54708]">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                Grounded content, with humans in control
              </p>
              <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[#17202A] sm:text-5xl lg:text-6xl">
                Turn product facts into marketing drafts your team can trust.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#64748B] sm:text-lg">
                NexusFlow helps commerce teams organize catalog data, create editable AI drafts, and review work before it reaches a connected channel.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-[#E85D2A] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#C94F22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009] focus-visible:ring-offset-2"
                >
                  Start with your catalog <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  href="#workflow"
                  className="inline-flex min-h-11 items-center justify-center rounded-control border border-[#E2E8F0] bg-white px-5 py-3 text-sm font-semibold text-[#17202A] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009] focus-visible:ring-offset-2"
                >
                  See the workflow
                </Link>
              </div>
              <ul className="mt-7 grid gap-2 text-sm text-[#475467] sm:grid-cols-2">
                {[
                  'Product-fact grounding',
                  'Editable drafts',
                  'Human approval states',
                  'No promised performance outcomes',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#16803C]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-xl rounded-card border border-[#E2E8F0] bg-white p-3 shadow-xl shadow-slate-900/5">
              <Image
                src="/hero-dashboard.png"
                alt="NexusFlow dashboard showing content workflow and campaign analytics"
                width={1220}
                height={860}
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="h-auto w-full rounded-lg"
              />
              <p className="px-2 pt-3 text-center text-xs text-[#64748B]">
                Illustrative product interface. Data shown is not a performance claim.
              </p>
            </div>
          </div>
        </section>

        {/* Foundation & Capabilities Section */}
        <section id="availability" className="border-y border-[#E2E8F0] bg-white px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B54708]">
              Available foundation
            </p>
            <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="font-display text-3xl font-extrabold tracking-tight">
                  Build your campaign process on real product data.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">
                  Start with the parts your team controls. Connectors and publishing are exposed only when their provider requirements are met.
                </p>
              </div>
              <Link
                href="/integrations"
                className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-[#175CD3] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009] focus-visible:ring-offset-2 md:self-auto"
              >
                View integrations <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {capabilities.map((capability) => (
                <div
                  key={capability}
                  className="flex gap-3 rounded-card border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#334155]"
                >
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#16803C]" />
                  {capability}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3-Step Reviewable Flow */}
        <section id="workflow" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B54708]">
                A simple reviewable flow
              </p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                From catalog to reviewed content in three steps.
              </h2>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {workflow.map(({ title, body, icon: Icon }, index) => (
                <li
                  key={title}
                  className="rounded-card border border-[#E2E8F0] bg-white p-6 shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#B54708]">0{index + 1}</span>
                    <Icon aria-hidden="true" className="h-5 w-5 text-[#E85D2A]" />
                  </div>
                  <h3 className="mt-8 font-display text-xl font-bold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#64748B]">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Hallmark Architecture & Verification Ledger Table */}
        <section className="border-y border-[#E2E8F0] bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B54708]">
                Truth in Engineering
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                Architecture & Security Verification Matrix
              </h2>
              <p className="mt-3 text-sm text-[#64748B]">
                NexusFlow enforces zero-simulation guarantees. Every data pipeline, encryption perimeter, and publishing step operates under verified protocols.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#E2E8F0] shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-[11px] font-mono uppercase tracking-wider text-[#64748B] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-5 py-3.5">Subsystem Module</th>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Operational Guarantee</th>
                    <th className="px-5 py-3.5">Security Protocol</th>
                    <th className="px-5 py-3.5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] bg-white">
                  {architectureLedger.map((row) => (
                    <tr key={row.code} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-semibold text-[#0F172A]">
                        {row.subsystem}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-500">
                        {row.code}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {row.guarantee}
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-600">
                        {row.protocol}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="h-3 w-3" /> {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Dynamic Public Pricing Section */}
        <section id="pricing" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="text-center max-w-3xl mx-auto mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B54708]">
                Transparent Subscriptions
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl text-[#0F172A]">
                Predictable, Quota-Grounded Pricing
              </h2>
              <p className="mt-3 text-sm text-[#64748B]">
                Live plans configured directly by the platform administration. No hidden platform surcharges or surprise billing surprises.
              </p>

              {/* Billing Cycle Toggle */}
              <div className="mt-8 inline-flex items-center p-1 rounded-full bg-slate-200/80 border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Annual billing</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
              {pricingTiers.map((tier) => {
                const currentPrice = billingCycle === 'annual' ? tier.annualPrice : tier.monthlyPrice;
                return (
                  <div
                    key={tier.id}
                    className={`rounded-2xl border bg-white p-7 flex flex-col justify-between transition-all relative ${
                      tier.popular
                        ? 'border-[#E85D2A] ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/5'
                        : 'border-[#E2E8F0] shadow-xs hover:border-slate-300'
                    }`}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#E85D2A] text-white shadow-xs">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-xl font-bold text-slate-900">{tier.name}</h3>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {tier.id}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#64748B] min-h-[32px]">{tier.tagline}</p>

                      <div className="mt-6 pb-6 border-b border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-slate-900 font-mono tracking-tight">
                            ${currentPrice}
                          </span>
                          <span className="text-xs text-[#64748B]">
                            /month {billingCycle === 'annual' && '(billed annually)'}
                          </span>
                        </div>
                      </div>

                      {/* Quotas Bento Grid */}
                      <div className="py-4 space-y-2 border-b border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Monthly Posts:</span>
                          <span className="font-mono font-semibold text-slate-900">{tier.postsLimit}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>AI Words Ceiling:</span>
                          <span className="font-mono font-semibold text-slate-900">{tier.aiWordsLimit}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Social Channels:</span>
                          <span className="font-mono font-semibold text-slate-900">{tier.channelsLimit}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Team Seats:</span>
                          <span className="font-mono font-semibold text-slate-900">{tier.seatsLimit}</span>
                        </div>
                      </div>

                      {/* Included Features */}
                      <div className="pt-4">
                        <p className="text-[11px] font-mono uppercase tracking-wider font-semibold text-slate-500 mb-2.5">
                          What&apos;s Included
                        </p>
                        <ul className="space-y-2 text-xs text-slate-700">
                          {tier.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-[#16803C] shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-8 pt-4">
                      <Link
                        href={`/register?plan=${tier.id.toLowerCase()}`}
                        className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
                          tier.popular
                            ? 'bg-[#E85D2A] hover:bg-[#C94F22] text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                        }`}
                      >
                        Get Started with {tier.name} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-[#64748B] mt-8">
              Billed in USD. Quotas reset on the 1st of each billing cycle. Need custom high-volume quotas?{' '}
              <Link href="/register" className="font-semibold text-[#175CD3] hover:underline">
                Contact platform sales
              </Link>
            </p>
          </div>
        </section>

        {/* Measurement Section */}
        <section className="bg-[#17202A] px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200">
                Measurement without made-up metrics
              </p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                See what your configuration can actually measure.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">
                Use tracking links and workspace data to understand activity. Revenue attribution and provider analytics require a supported connector, consent, and a successful data mapping.
              </p>
            </div>
            <div className="rounded-card border border-white/15 bg-white/5 p-6">
              <LineChart aria-hidden="true" className="h-7 w-7 text-orange-300" />
              <p className="mt-5 font-display text-xl font-bold">No forecast masquerading as a result.</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                NexusFlow keeps unsupported or unavailable measurements visibly separate from verified workspace data.
              </p>
              <Link
                href="/campaigns"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-control bg-white px-4 py-3 text-sm font-bold text-[#17202A] transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009] focus-visible:ring-offset-2 focus-visible:ring-offset-[#17202A]"
              >
                Explore campaign tracking <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section id="faqs" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-[#B54708]">
              Answers before you sign up
            </p>
            <h2 className="mt-3 text-center font-display text-3xl font-extrabold tracking-tight">
              Know what to expect.
            </h2>
            <div className="mt-8 divide-y divide-[#E2E8F0] rounded-card border border-[#E2E8F0] bg-white px-5 shadow-xs">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={faq.question} className="py-1">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={faqIds[index]}
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left text-sm font-bold text-[#17202A] hover:text-[#B54708] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F79009] focus-visible:ring-offset-2"
                    >
                      {faq.question}
                      {isOpen ? (
                        <ChevronUp aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
                      )}
                    </button>
                    {isOpen && (
                      <p id={faqIds[index]} className="pb-5 text-sm leading-6 text-[#64748B]">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom Call to Action */}
        <section className="px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-5xl rounded-card bg-[#E85D2A] px-6 py-10 text-center text-white sm:px-12 sm:py-14 shadow-lg shadow-orange-500/10">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Start with the catalog you already have.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-orange-50">
              Create your workspace, add product data, and decide what is ready for review before connecting a publishing channel.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-control bg-white px-5 py-3 text-sm font-bold text-[#17202A] shadow-sm transition-colors hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#E85D2A]"
            >
              Create a workspace <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
