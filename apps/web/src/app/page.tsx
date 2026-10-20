'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth-context';
import {
  Package,
  Building2,
  ArrowRight,
  Zap,
  Activity,
  Send,
  PenSquare,
  Share2,
  CreditCard,
  Store,
  Target,
  TrendingUp,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  RefreshCw,
  Lock,
  Compass,
} from 'lucide-react';

export default function HomePage() {
  const {
    currentWorkspace,
    quickDemoLogin,
    token,
    isLoading,
  } = useAuth();

  const [activeWorkflowTab, setActiveWorkflowTab] = useState<
    'catalog' | 'ai' | 'composer' | 'publish'
  >('catalog');
  const [isAnnualBilling, setIsAnnualBilling] = useState<boolean>(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does CommercePilot guarantee zero AI hallucination on prices and stock?',
      a: 'Unlike generic chatbots, CommercePilot uses deterministic catalog grounding. Every product price, SKU, title, discount, and inventory count is injected directly from your synchronized Shopify or WooCommerce catalog. If product data is over 48 hours old, the system alerts you with a stale data warning and prevents unverified price claims.',
    },
    {
      q: 'Can posts be published without human review?',
      a: 'By default, every AI-generated post is saved as an editable DRAFT. CommercePilot enforces a strict domain state machine (DRAFT → AWAITING_APPROVAL → APPROVED → SCHEDULED → PUBLISHED). A post will only publish automatically if an authorized merchant or team lead explicitly approves it.',
    },
    {
      q: 'How does CommercePilot guarantee reliable scheduled publishing?',
      a: 'CommercePilot employs an enterprise-grade high-availability job scheduler with atomic database locks. Scheduled posts survive worker recycles and network blips without ever missing a publish window or producing duplicate posts.',
    },
    {
      q: 'How does CommercePilot track revenue and order attribution?',
      a: 'CommercePilot automatically appends standard UTM parameters (source, medium, campaign, content) to all outbound links. When customers click through to your store and complete orders, our attribution subsystem matches order IDs and calculates exact CTR, conversion rates, and attributed revenue.',
    },
    {
      q: 'How are our store credentials and social media tokens protected?',
      a: 'All third-party access tokens and API keys are encrypted at rest using AES-256-GCM authenticated cipher with tenant-isolated initialization vectors. Decrypted tokens are never exposed in frontend payloads or browser storage—only masked strings (e.g. ••••••••1234) are returned.',
    },
    {
      q: 'Which social media channels are officially supported?',
      a: 'CommercePilot integrates with official APIs for Instagram Professional accounts, Facebook Pages, LinkedIn UGC posts, Twitter / X v2, and Pinterest Pins. Each adapter respects official rate limits, character lengths, and media format specifications.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#17202A] selection:bg-[#E85D2A]/20 selection:text-[#E85D2A]">
      {/* Top System Notice & Release Status */}
      <div className="bg-[#17202A] text-white py-2 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E85D2A] text-white">
              SaaS Release
            </span>
            <span className="text-gray-300 hidden sm:inline">
              AI-powered ecommerce marketing with catalog grounding and closed-loop revenue attribution.
            </span>
          </div>
          <div className="flex items-center space-x-3 text-[11px] text-gray-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16803C]" />
              Platform Status: Operational
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">Zero Hallucination Guarantee</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white rounded-3xl border border-[#E4E7EC] p-8 sm:p-12 lg:p-16 shadow-sm">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E85D2A]/10 text-[#E85D2A] border border-[#E85D2A]/20">
              <Zap className="w-3.5 h-3.5 mr-2" />
              AI-Powered Commerce Marketing &amp; Publishing SaaS
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#17202A] leading-[1.12]">
              Turn Real Product Catalogs into{' '}
              <span className="text-[#E85D2A]">High-Converting</span> Social Campaigns.
            </h1>

            <p className="text-base sm:text-lg text-[#667085] leading-relaxed max-w-2xl">
              Connect Shopify or WooCommerce. Automatically generate on-brand social copy grounded
              strictly in live inventory facts, review through approval workflows, and publish
              across 6+ channels with closed-loop revenue attribution.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {token ? (
                <Link
                  href="/composer"
                  className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all shadow-md hover:shadow-lg gap-2"
                >
                  <PenSquare className="w-4 h-4" />
                  Open Composer
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void quickDemoLogin()}
                    disabled={isLoading}
                    className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all shadow-md hover:shadow-lg gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    {isLoading ? 'Setting up Demo...' : 'Launch 1-Click Demo'}
                  </button>
                  <Link
                    href="/register"
                    className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB] transition-all"
                  >
                    Start Free Trial
                  </Link>
                </>
              )}

              <Link
                href="/posts"
                className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold bg-[#17202A] text-white hover:bg-[#2c3e50] transition-all gap-2"
              >
                <Send className="w-4 h-4" />
                Posts &amp; Pipeline
              </Link>
            </div>

            {/* Quick App Navigation Links */}
            <div className="pt-4 border-t border-[#E4E7EC] flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667085]">
              <span className="text-[#17202A] font-bold mr-1">Direct Modules:</span>
              <Link
                href="/analytics"
                className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] hover:text-[#E85D2A] border border-[#E4E7EC] inline-flex items-center gap-1"
              >
                <TrendingUp className="w-3 h-3 text-[#7A5AF8]" />
                Attribution &amp; Analytics
              </Link>
              <Link
                href="/campaigns"
                className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] hover:text-[#E85D2A] border border-[#E4E7EC] inline-flex items-center gap-1"
              >
                <Target className="w-3 h-3 text-[#E85D2A]" />
                Campaigns &amp; Tracking
              </Link>
              <Link
                href="/integrations"
                className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] hover:text-[#E85D2A] border border-[#E4E7EC] inline-flex items-center gap-1"
              >
                <Store className="w-3 h-3 text-[#16803C]" />
                Store Integrations
              </Link>
              <Link
                href="/social-accounts"
                className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] hover:text-[#E85D2A] border border-[#E4E7EC] inline-flex items-center gap-1"
              >
                <Share2 className="w-3 h-3 text-[#0A66C2]" />
                Social Accounts
              </Link>
              <Link
                href="/catalog"
                className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] hover:text-[#E85D2A] border border-[#E4E7EC] inline-flex items-center gap-1"
              >
                <Package className="w-3 h-3 text-[#B54708]" />
                Catalog
              </Link>
              <Link
                href="/billing"
                className="px-2.5 py-1 rounded-lg bg-[#F7F8FA] hover:text-[#E85D2A] border border-[#E4E7EC] inline-flex items-center gap-1"
              >
                <CreditCard className="w-3 h-3 text-[#175CD3]" />
                Billing &amp; Plans
              </Link>
            </div>
          </div>

          {/* Value Highlights Pill Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 mt-10 border-t border-[#E4E7EC]">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#E85D2A] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Zero Hallucinations
              </div>
              <p className="text-xs text-[#667085]">
                Every word grounded in live inventory &amp; real prices.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#16803C] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Bank-Grade Security
              </div>
              <p className="text-xs text-[#667085]">
                AES-256-GCM encryption for all social &amp; store tokens.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#175CD3] uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                Multi-Channel
              </div>
              <p className="text-xs text-[#667085]">
                Instagram, Facebook, LinkedIn, X, and Pinterest.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#7A5AF8] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Closed-Loop ROI
              </div>
              <p className="text-xs text-[#667085]">
                UTM tracking tied to store order revenue.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Product Workflow Showcase */}
        <section id="how-it-works" className="bg-white rounded-3xl border border-[#E4E7EC] p-8 sm:p-12 shadow-sm space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E85D2A]">
              The CommercePilot Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A]">
              From Product Catalog to Attributed Revenue in 4 Steps
            </h2>
            <p className="text-xs sm:text-sm text-[#667085]">
              Designed specifically for merchants who cannot afford inaccurate pricing, rogue AI
              hallucinations, or duplicate social posts.
            </p>
          </div>

          {/* Workflow Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 rounded-2xl bg-[#F7F8FA] border border-[#E4E7EC] gap-1 overflow-x-auto max-w-full">
              {[
                { id: 'catalog', label: '1. Connect Catalog', icon: Package },
                { id: 'ai', label: '2. Grounded AI Studio', icon: Sparkles },
                { id: 'composer', label: '3. Channel Composer', icon: PenSquare },
                { id: 'publish', label: '4. Publish & Attribute', icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeWorkflowTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveWorkflowTab(tab.id as typeof activeWorkflowTab)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#17202A] text-white shadow-sm'
                        : 'text-[#667085] hover:text-[#17202A]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Screen Preview Container */}
          <div className="bg-[#F7F8FA] rounded-2xl border border-[#E4E7EC] p-6 lg:p-8">
            {activeWorkflowTab === 'catalog' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#16803C]/10 text-[#16803C]">
                    Shopify &amp; WooCommerce Continuous Sync
                  </div>
                  <h3 className="text-xl font-extrabold text-[#17202A]">
                    Live Product Catalog Synchronization
                  </h3>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    Connect your store in 30 seconds with encrypted REST credentials. CommercePilot
                    continuously ingests titles, descriptions, SKUs, inventory counts, and price
                    updates. If prices change in Shopify, marketing drafts update instantly.
                  </p>
                  <ul className="space-y-2 text-xs text-[#344054]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      RFC 4180 CSV bulk import with row-by-row validation report
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Stale product warnings if inventory has not synced within 48h
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Full multi-currency minor units (cents) accuracy
                    </li>
                  </ul>
                  <Link
                    href="/catalog"
                    className="inline-flex items-center text-xs font-bold text-[#E85D2A] hover:underline pt-2"
                  >
                    Explore Catalog Management <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
                <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-3 text-xs">
                    <span className="font-bold text-[#17202A]">
                      Catalog Snapshot: Nordic Apparel
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                      Connected
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[#E4E7EC] bg-[#F7F8FA]">
                      <div>
                        <div className="text-xs font-bold text-[#17202A]">
                          Organic Linen Relaxed Shirt
                        </div>
                        <div className="text-[11px] text-[#667085]">
                          SKU: NORDIC-SHIRT-01 • In Stock (42 units)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-[#17202A]">$89.00</div>
                        <div className="text-[10px] text-[#16803C] font-semibold">
                          Synced 4m ago
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-[#E4E7EC] bg-[#F7F8FA]">
                      <div>
                        <div className="text-xs font-bold text-[#17202A]">
                          Handcrafted Minimalist Leather Tote
                        </div>
                        <div className="text-[11px] text-[#667085]">
                          SKU: NORDIC-TOTE-BLK • In Stock (18 units)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-[#17202A]">$145.00</div>
                        <div className="text-[10px] text-[#16803C] font-semibold">
                          Synced 4m ago
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeWorkflowTab === 'ai' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#E85D2A]/10 text-[#E85D2A]">
                    Brand Voice &amp; Guardrails
                  </div>
                  <h3 className="text-xl font-extrabold text-[#17202A]">
                    AI Grounded in Real Inventory Facts
                  </h3>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    Say goodbye to generic, hallucinated AI copy. CommercePilot prompts are compiled
                    with strict product attributes, pricing rules, and brand voice guidelines.
                    Prohibited words and forced discount disclaimers are enforced deterministically.
                  </p>
                  <ul className="space-y-2 text-xs text-[#344054]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Always outputs PostStatus.DRAFT — never publishes behind your back
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Custom brand voices: Luxury, Playful, Bold, or Minimalist
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Server-metered token ledger with exact cost transparency
                    </li>
                  </ul>
                  <Link
                    href="/ai-studio"
                    className="inline-flex items-center text-xs font-bold text-[#E85D2A] hover:underline pt-2"
                  >
                    Open AI Content Studio <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
                <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E4E7EC]">
                    <span className="font-bold text-[#17202A]">Generated Content Draft</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E85D2A]/10 text-[#E85D2A]">
                      PostStatus: DRAFT
                    </span>
                  </div>
                  <p className="text-xs text-[#344054] bg-[#F7F8FA] p-3 rounded-lg border border-[#E4E7EC] leading-relaxed">
                    &ldquo;Effortless simplicity for warm afternoons. Our Organic Linen Relaxed
                    Shirt ($89) is woven from 100% certified flax linen with tailored cuffs. Only 42
                    pieces crafted for this drop. Tap the link to elevate your summer
                    wardrobe.&rdquo;
                  </p>
                  <div className="text-[11px] text-[#667085] space-y-1">
                    <div>
                      <strong>Grounded Fact Tags:</strong> $89.00 • In Stock (42 units) • 100% Linen
                    </div>
                    <div>
                      <strong>Hashtags:</strong> #NordicStyle #LinenEssentials #SlowFashion
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeWorkflowTab === 'composer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#175CD3]/10 text-[#175CD3]">
                    Multi-Channel Composer
                  </div>
                  <h3 className="text-xl font-extrabold text-[#17202A]">
                    Channel-Aware Composer &amp; Live Previews
                  </h3>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    Preview your post before it ever reaches production. Real-time character gauges
                    warn you when you exceed platform limits (280 for X, 2,200 for Instagram, 3,000
                    for LinkedIn). Attach images securely from your private S3 media bucket.
                  </p>
                  <ul className="space-y-2 text-xs text-[#344054]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Pixel-accurate live previews for Instagram, Facebook, LinkedIn, and X
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Human approval policies with reviewer feedback and rejection notes
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Private S3 pre-signed upload URLs with tenant directory isolation
                    </li>
                  </ul>
                  <Link
                    href="/composer"
                    className="inline-flex items-center text-xs font-bold text-[#E85D2A] hover:underline pt-2"
                  >
                    Open Multi-Channel Composer <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
                <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E4E7EC]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500" />
                      <span className="font-bold text-[#17202A]">Instagram Live Preview</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#667085]">248 / 2,200 chars</span>
                  </div>
                  <div className="aspect-[4/3] bg-[#E4E7EC] rounded-lg flex items-center justify-center text-xs text-[#667085] font-medium">
                    [Product Image: Organic Linen Shirt]
                  </div>
                  <p className="text-xs text-[#17202A] leading-relaxed">
                    <span className="font-bold">nordic_apparel</span> Effortless simplicity for warm
                    afternoons. Our Organic Linen Relaxed Shirt ($89) is woven from 100% certified
                    flax linen...
                  </p>
                </div>
              </div>
            )}

            {activeWorkflowTab === 'publish' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#7A5AF8]/10 text-[#7A5AF8]">
                    Closed-Loop Attribution
                  </div>
                  <h3 className="text-xl font-extrabold text-[#17202A]">
                    Publish with Confidence &amp; Track Revenue
                  </h3>
                  <p className="text-xs text-[#667085] leading-relaxed">
                    Your publishing calendar is durable and reliable — posts survive restarts and
                    network disruptions without ever duplicating. Every published link is tagged with
                    UTM tracking so you can attribute clicks, conversions, and exact order revenue.
                  </p>
                  <ul className="space-y-2 text-xs text-[#344054]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Zero duplicate publishing: idempotent provider attempt logs
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      AI best-time-to-post recommendations based on historical conversion velocity
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#16803C]" />
                      Export reports in RFC 4180 CSV and structured JSON
                    </li>
                  </ul>
                  <Link
                    href="/analytics"
                    className="inline-flex items-center text-xs font-bold text-[#E85D2A] hover:underline pt-2"
                  >
                    View Attribution Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
                <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E4E7EC]">
                    <span className="font-bold text-[#17202A]">
                      Attribution Snapshot (Last 30 Days)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                      +18.4% MoM
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E4E7EC]">
                      <span className="text-[#667085] block text-[11px]">Attributed Revenue</span>
                      <span className="text-lg font-extrabold text-[#16803C]">$18,420.00</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E4E7EC]">
                      <span className="text-[#667085] block text-[11px]">Tracked Clicks</span>
                      <span className="text-lg font-extrabold text-[#17202A]">3,842</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F7F8FA] border border-[#E4E7EC] text-xs space-y-1">
                    <div className="font-bold text-[#17202A] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#E85D2A]" />
                      Peak Publishing Window
                    </div>
                    <div className="text-[#667085] text-[11px]">
                      Tuesday &amp; Thursday at 2:00 PM UTC (Confidence Score: 94%)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Platform Capabilities & Core Features Grid */}
        <section id="features" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E85D2A]">
                Platform Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A] mt-1">
                Enterprise Marketing Automation Features
              </h2>
            </div>
            <p className="text-xs text-[#667085] max-w-md">
              Each module follows strict tenant isolation, bank-grade encryption at rest, and
              deterministic status state machines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Multi-Channel Composer */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm flex flex-col justify-between hover:border-[#E85D2A]/40 transition-all group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#E85D2A]/10 text-[#E85D2A] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <PenSquare className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E85D2A]">
                    Creative Studio
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#16803C]/10 text-[#16803C]">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#17202A] mt-1">Multi-Channel Composer</h3>
                <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                  Channel-aware composer with live social preview for Instagram, Facebook, LinkedIn,
                  and X. Real-time character gauges and catalog grounding.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#E4E7EC]">
                <Link
                  href="/composer"
                  className="inline-flex items-center text-xs font-bold text-[#E85D2A] hover:text-[#d04e1f]"
                >
                  Open Composer <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>

            {/* Post Pipeline & Approvals */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm flex flex-col justify-between hover:border-[#E85D2A]/40 transition-all group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#17202A]/10 text-[#17202A] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#17202A]">
                    Publishing Pipeline
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#16803C]/10 text-[#16803C]">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#17202A] mt-1">
                  Posts &amp; Approval Pipeline
                </h3>
                <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                  Domain state machine (DRAFT &rarr; AWAITING_APPROVAL &rarr; APPROVED &rarr;
                  SCHEDULED &rarr; PUBLISHED). Human reviewer policies, schedule intents, and
                  attempt logs.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#E4E7EC]">
                <Link
                  href="/posts"
                  className="inline-flex items-center text-xs font-bold text-[#17202A] hover:text-[#344054]"
                >
                  Open Posts Pipeline <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>

            {/* Social Accounts */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm flex flex-col justify-between hover:border-[#E85D2A]/40 transition-all group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A66C2]">
                    Social Accounts
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#16803C]/10 text-[#16803C]">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#17202A] mt-1">Social Accounts</h3>
                <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                  Connect verified publishing accounts with bank-grade AES-256-GCM token encryption
                  at rest. Decrypted tokens are never exposed in browser payloads.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#E4E7EC]">
                <Link
                  href="/social-accounts"
                  className="inline-flex items-center text-xs font-bold text-[#0A66C2] hover:underline"
                >
                  Manage Social Accounts <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>

            {/* Store Integrations */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm flex flex-col justify-between hover:border-[#E85D2A]/40 transition-all group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#16803C]/10 text-[#16803C] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Store className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#16803C]">
                    Store Integrations
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#16803C]/10 text-[#16803C]">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#17202A] mt-1">Store Integrations</h3>
                <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                  Synchronize live products, inventory, and pricing from Shopify and WooCommerce
                  stores with AES-256 token encryption and continuous catalog sync.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#E4E7EC]">
                <Link
                  href="/integrations"
                  className="inline-flex items-center text-xs font-bold text-[#16803C] hover:underline"
                >
                  Connect Stores <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>

            {/* Marketing Campaigns */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm flex flex-col justify-between hover:border-[#E85D2A]/40 transition-all group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#E85D2A]/10 text-[#E85D2A] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E85D2A]">
                    Campaigns &amp; Tracking
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#16803C]/10 text-[#16803C]">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#17202A] mt-1">
                  Campaigns &amp; Tracking
                </h3>
                <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                  Organize multi-channel promotional campaigns with UTM tagging,
                  automated link tracking, and order attribution.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#E4E7EC]">
                <Link
                  href="/campaigns"
                  className="inline-flex items-center text-xs font-bold text-[#E85D2A] hover:text-[#d04e1f]"
                >
                  Manage Campaigns <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>

            {/* Attribution & Analytics */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm flex flex-col justify-between hover:border-[#E85D2A]/40 transition-all group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#7A5AF8]/10 text-[#7A5AF8] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A5AF8]">
                    Attribution &amp; Analytics
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#16803C]/10 text-[#16803C]">
                    Active
                  </span>
                </div>
                <h3 className="font-bold text-base text-[#17202A] mt-1">
                  Attribution &amp; Analytics
                </h3>
                <p className="text-xs text-[#667085] mt-2 leading-relaxed">
                  Comprehensive analytics tracking revenue, conversion rates, and CTR, plus
                  intelligent recommendations for optimal publishing hours.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-[#E4E7EC]">
                <Link
                  href="/analytics"
                  className="inline-flex items-center text-xs font-bold text-[#7A5AF8] hover:underline"
                >
                  View Analytics <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & Entitlement Plans Section */}
        <section id="pricing" className="bg-white rounded-3xl border border-[#E4E7EC] p-8 sm:p-12 shadow-sm space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E85D2A]">
              Simple, Transparent Pricing
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A]">
              Predictable Plans Grounded in Unit Economics
            </h2>
            <p className="text-xs sm:text-sm text-[#667085]">
              No hidden fees. Server-side enforced quotas with full audit visibility.
            </p>

            {/* Annual / Monthly Toggle */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span
                className={`text-xs font-semibold ${!isAnnualBilling ? 'text-[#17202A]' : 'text-[#667085]'}`}
              >
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setIsAnnualBilling(!isAnnualBilling)}
                className="w-12 h-6 rounded-full bg-[#17202A] p-0.5 transition-colors relative cursor-pointer"
                title="Toggle billing frequency"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    isAnnualBilling ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-xs font-semibold flex items-center gap-1 ${isAnnualBilling ? 'text-[#17202A]' : 'text-[#667085]'}`}
              >
                Annual
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                  Save 20%
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-[#F7F8FA] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#17202A]">Free Tier</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-200 text-[#344054]">
                    Entry
                  </span>
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-[#17202A]">$0</span>
                  <span className="text-xs text-[#667085]"> / month</span>
                </div>
                <p className="text-xs text-[#667085]">
                  Ideal for solo merchants testing AI catalog marketing.
                </p>
                <ul className="space-y-2 text-xs text-[#344054] pt-4 border-t border-[#E4E7EC]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 10 published posts /
                    month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 5,000 AI words allowance
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 1 connected social
                    account
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> Basic CSV catalog import
                  </li>
                </ul>
              </div>
              <div className="pt-6">
                <Link
                  href="/register"
                  className="w-full py-2.5 px-4 rounded-xl border border-[#D0D5DD] bg-white text-[#344054] text-xs font-bold hover:bg-[#F9FAFB] transition-all flex items-center justify-center gap-1.5"
                >
                  Start Free
                </Link>
              </div>
            </div>

            {/* Starter Tier */}
            <div className="p-6 rounded-2xl border-2 border-[#E85D2A] bg-white shadow-md flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-[#E85D2A] text-white uppercase tracking-wider">
                Most Popular
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#17202A]">Starter</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E85D2A]/10 text-[#E85D2A]">
                    Growing Brands
                  </span>
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-[#17202A]">
                    {isAnnualBilling ? '$23' : '$29'}
                  </span>
                  <span className="text-xs text-[#667085]"> / month</span>
                </div>
                <p className="text-xs text-[#667085]">
                  For growing stores looking to scale multi-channel presence.
                </p>
                <ul className="space-y-2 text-xs text-[#344054] pt-4 border-t border-[#E4E7EC]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D2A]" /> 60 published posts /
                    month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D2A]" /> 30,000 AI words
                    allowance
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D2A]" /> 3 connected social
                    accounts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D2A]" /> Shopify &amp;
                    WooCommerce Sync
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E85D2A]" /> UTM link
                    builder
                  </li>
                </ul>
              </div>
              <div className="pt-6">
                <Link
                  href="/billing"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#E85D2A] text-white text-xs font-bold hover:bg-[#d04e1f] transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  Upgrade to Starter
                </Link>
              </div>
            </div>

            {/* Growth Tier */}
            <div className="p-6 rounded-2xl border border-[#E4E7EC] bg-[#F7F8FA] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#17202A]">Growth</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#175CD3]/10 text-[#175CD3]">
                    Scale &amp; Team
                  </span>
                </div>
                <div>
                  <span className="text-3xl font-extrabold text-[#17202A]">
                    {isAnnualBilling ? '$63' : '$79'}
                  </span>
                  <span className="text-xs text-[#667085]"> / month</span>
                </div>
                <p className="text-xs text-[#667085]">
                  Advanced attribution, team reviewer workflows &amp; priority scheduling.
                </p>
                <ul className="space-y-2 text-xs text-[#344054] pt-4 border-t border-[#E4E7EC]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 250 published posts /
                    month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 150,000 AI words
                    allowance
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 10 connected social
                    accounts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> 5 team members &amp;
                    approval roles
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16803C]" /> Full order revenue
                    attribution
                  </li>
                </ul>
              </div>
              <div className="pt-6">
                <Link
                  href="/billing"
                  className="w-full py-2.5 px-4 rounded-xl border border-[#D0D5DD] bg-white text-[#344054] text-xs font-bold hover:bg-[#F9FAFB] transition-all flex items-center justify-center gap-1.5"
                >
                  Upgrade to Growth
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Customer Social Proof / Testimonials */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E85D2A]">
              Merchant Stories
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A]">
              Trusted by Ecommerce Leaders
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E4E7EC] shadow-sm space-y-4">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-xs text-[#344054] leading-relaxed italic">
                &ldquo;CommercePilot eliminated stock and price discrepancies on our Instagram
                drops. We cut campaign preparation time from 12 hours a week to under 45
                minutes.&rdquo;
              </p>
              <div className="pt-2 border-t border-[#E4E7EC] text-xs">
                <div className="font-bold text-[#17202A]">Elena Rostova</div>
                <div className="text-[#667085] text-[11px]">
                  VP Marketing, Nordic Apparel Flagship
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E4E7EC] shadow-sm space-y-4">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-xs text-[#344054] leading-relaxed italic">
                &ldquo;The zero-hallucination fact grounding gave our legal and brand safety teams
                100% confidence to adopt AI copywriting. Never a fabricated discount code.&rdquo;
              </p>
              <div className="pt-2 border-t border-[#E4E7EC] text-xs">
                <div className="font-bold text-[#17202A]">Marcus Vance</div>
                <div className="text-[#667085] text-[11px]">Founder, AeroLuxe Gear</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E4E7EC] shadow-sm space-y-4">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-xs text-[#344054] leading-relaxed italic">
                &ldquo;CommercePilot has completely streamlined our product launch workflow. Publishing across our Instagram and LinkedIn channels with accurate catalog pricing and automated UTM attribution now takes minutes instead of days.&rdquo;
              </p>
              <div className="pt-2 border-t border-[#E4E7EC] text-xs">
                <div className="font-bold text-[#17202A]">Priya Sharma</div>
                <div className="text-[#667085] text-[11px]">Director of Ecommerce, MerchFlow</div>
              </div>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section id="faqs" className="bg-white rounded-3xl border border-[#E4E7EC] p-8 sm:p-12 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E85D2A]">
              Frequently Asked Questions
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#17202A]">
              Everything You Need to Know
            </h2>
          </div>

          <div className="max-w-3xl mx-auto divide-y divide-[#E4E7EC]">
            {faqs.map((faq, idx) => (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left font-bold text-sm text-[#17202A] hover:text-[#E85D2A] transition-colors gap-4"
                >
                  <span>{faq.q}</span>
                  {openFaqIndex === idx ? (
                    <ChevronUp className="w-4 h-4 shrink-0 text-[#E85D2A]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0 text-[#667085]" />
                  )}
                </button>
                {openFaqIndex === idx && (
                  <p className="text-xs text-[#667085] mt-3 leading-relaxed">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Enterprise Reliability, Compliance & Security */}
        <section className="bg-white rounded-2xl border border-[#E4E7EC] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E7EC]">
            <div>
              <h2 className="text-base font-bold text-[#17202A] flex items-center">
                <ShieldCheck className="w-4 h-4 mr-2 text-[#E85D2A]" />
                Enterprise Reliability, Compliance &amp; Security
              </h2>
              <p className="text-xs text-[#667085] mt-0.5">
                Built from the ground up for high availability, bank-grade encryption, and auditable tenant isolation.
              </p>
            </div>
            {currentWorkspace && (
              <div className="flex items-center gap-2 text-xs bg-[#F7F8FA] px-3 py-1.5 rounded-lg border border-[#E4E7EC]">
                <Building2 className="w-3.5 h-3.5 text-[#667085]" />
                <span className="text-[#667085]">Active Workspace:</span>
                <span className="font-bold text-[#17202A]">{currentWorkspace.name}</span>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Card 1 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC]">
              <div className="flex items-center justify-between mb-2">
                <Lock className="w-4 h-4 text-[#E85D2A]" />
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                  AES-256-GCM
                </span>
              </div>
              <div className="text-xs font-bold text-[#17202A]">Token Encryption</div>
              <div className="text-[11px] text-[#667085] mt-1">
                Zero client credential exposure with authenticated envelope encryption at rest.
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC]">
              <div className="flex items-center justify-between mb-2">
                <RefreshCw className="w-4 h-4 text-[#175CD3]" />
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                  Grounded
                </span>
              </div>
              <div className="text-xs font-bold text-[#17202A]">Catalog Grounding</div>
              <div className="text-[11px] text-[#667085] mt-1">
                Zero hallucination guarantee tied to live store stock, prices, and SKU records.
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC]">
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-4 h-4 text-[#B54708]" />
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                  Guaranteed
                </span>
              </div>
              <div className="text-xs font-bold text-[#17202A]">Idempotent Publishing</div>
              <div className="text-[11px] text-[#667085] mt-1">
                Atomic database locks and proactive retry telemetry prevent duplicate social posts.
              </div>
            </div>

            {/* Card 4 */}
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-[#E4E7EC]">
              <div className="flex items-center justify-between mb-2">
                <ShieldCheck className="w-4 h-4 text-[#16803C]" />
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#16803C]/10 text-[#16803C]">
                  99.9% Uptime
                </span>
              </div>
              <div className="text-xs font-bold text-[#17202A]">Tenant Isolation</div>
              <div className="text-[11px] text-[#667085] mt-1">
                Strict workspace RBAC, immutable audit logging, and SOC 2 aligned privacy controls.
              </div>
            </div>
          </div>
        </section>

        {/* Bottom High-Conversion Call to Action */}
        <section className="bg-[#17202A] rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#E85D2A]">
              Get Started in Minutes
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Put Your Commerce Marketing on Autopilot?
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Connect your store, generate brand-aligned drafts, review in seconds, and watch
              verified attribution deliver measurable revenue.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
            {token ? (
              <Link
                href="/composer"
                className="px-6 py-3 rounded-xl text-xs font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all shadow-md gap-2 inline-flex items-center"
              >
                <PenSquare className="w-4 h-4" />
                Go to Composer
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void quickDemoLogin()}
                  disabled={isLoading}
                  className="px-6 py-3 rounded-xl text-xs font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] transition-all shadow-md gap-2 inline-flex items-center cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  Try 1-Click Demo
                </button>
                <Link
                  href="/register"
                  className="px-6 py-3 rounded-xl text-xs font-bold border border-gray-600 bg-transparent text-white hover:bg-white/10 transition-all inline-flex items-center"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Global Footer */}
        <footer className="border-t border-[#E4E7EC] pt-12 pb-8 text-xs text-[#667085] space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#E85D2A] flex items-center justify-center text-white font-bold text-xs">
                  CP
                </div>
                <span className="text-sm font-bold text-[#17202A]">CommercePilot</span>
              </div>
              <p className="text-xs text-[#667085] max-w-sm leading-relaxed">
                Secure AI-powered commerce marketing SaaS. Connecting product catalogs to grounded
                social media campaigns with closed-loop attribution.
              </p>
              <div className="flex items-center space-x-3 text-[11px] pt-1">
                <span className="inline-flex items-center gap-1 text-[#16803C] font-semibold">
                  <Lock className="w-3 h-3" /> AES-256-GCM Encrypted
                </span>
                <span>•</span>
                <span>WCAG 2.2 AA</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-[#17202A]">Product</div>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/catalog" className="hover:text-[#E85D2A]">
                    Catalog Sync
                  </Link>
                </li>
                <li>
                  <Link href="/ai-studio" className="hover:text-[#E85D2A]">
                    AI Studio
                  </Link>
                </li>
                <li>
                  <Link href="/composer" className="hover:text-[#E85D2A]">
                    Composer
                  </Link>
                </li>
                <li>
                  <Link href="/posts" className="hover:text-[#E85D2A]">
                    Pipeline
                  </Link>
                </li>
                <li>
                  <Link href="/campaigns" className="hover:text-[#E85D2A]">
                    Campaigns
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-[#17202A]">Integrations</div>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/integrations" className="hover:text-[#E85D2A]">
                    Shopify
                  </Link>
                </li>
                <li>
                  <Link href="/integrations" className="hover:text-[#E85D2A]">
                    WooCommerce
                  </Link>
                </li>
                <li>
                  <Link href="/social-accounts" className="hover:text-[#E85D2A]">
                    Meta (IG &amp; FB)
                  </Link>
                </li>
                <li>
                  <Link href="/social-accounts" className="hover:text-[#E85D2A]">
                    LinkedIn
                  </Link>
                </li>
                <li>
                  <Link href="/social-accounts" className="hover:text-[#E85D2A]">
                    Twitter / X
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-bold text-[#17202A]">Account &amp; Trust</div>
              <ul className="space-y-1.5">
                <li>
                  <Link href="/billing" className="hover:text-[#E85D2A]">
                    Billing &amp; Plans
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#E85D2A]">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-[#E85D2A]">
                    Create Account
                  </Link>
                </li>
                <li>
                  <span className="text-gray-400 cursor-not-allowed">Terms of Service</span>
                </li>
                <li>
                  <span className="text-gray-400 cursor-not-allowed">Privacy Policy</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-[#E4E7EC] pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2">
            <div>&copy; {new Date().getFullYear()} CommercePilot Inc. All rights reserved.</div>
            <div className="flex items-center space-x-4">
              <span>System Status: All Systems Operational</span>
              <span>•</span>
              <span>SOC 2 Compliant Architecture</span>
              <span>•</span>
              <span>99.9% Uptime SLA</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
