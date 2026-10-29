'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { V3Navbar } from './v3-navbar';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  Lock,
  ShieldCheck,
  Zap,
  Smartphone,
  Sparkles,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreHorizontal,
  Briefcase,
  Flame,
  Lightbulb,
  Droplets,
  CheckCircle2,
} from 'lucide-react';
import { NexusDynamicIsland } from './ui/nexus-dynamic-island';
import IPhone17Pro from './ui/apple-iphone-17-pro';
import { SpotlightCard } from './ui/spotlight-card';
import { ShiftCard } from './ui/shift-card';
import { BorderBeamButton } from './ui/border-beam-button';
import { DirectionAwareTabs } from './ui/direction-aware-tabs';
import { HaloTabs, HaloTabsList, HaloTabsTrigger, HaloTabsIndicator } from './ui/halo-tabs';
import {
  Expandable,
  ExpandableCard,
  ExpandableCardHeader,
  ExpandableCardContent,
  ExpandableCardFooter,
  ExpandableTrigger,
  ExpandableContent,
} from './ui/expandable';
import { BadgeGlow } from './ui/badge-glow';
import { CodeBlock } from './ui/code-block';

interface LandingPageV3Props {
  onSwitchToV1?: () => void;
}

interface ProductShowcase {
  id: string;
  name: string;
  sku: string;
  price: string;
  inventory: number;
  category: string;
  tagline: string;
  imageBg: string;
  icon: typeof Flame;
  accentColor: string;
}

const SHOWCASE_PRODUCTS: ProductShowcase[] = [
  {
    id: 'prod-1',
    name: 'AeroGlide Pro Runner',
    sku: 'AG-RN-09',
    price: '$149.00',
    inventory: 9,
    category: 'Footwear',
    tagline: 'Carbon propulsion plate with ISO 9237 breathable mesh.',
    imageBg: 'from-orange-500/20 via-amber-500/10 to-slate-100',
    icon: Flame,
    accentColor: 'text-orange-500 bg-orange-50 border-orange-200/60',
  },
  {
    id: 'prod-2',
    name: 'Nordic Brass Desk Lamp',
    sku: 'NM-LAMP-01',
    price: '$89.00',
    inventory: 48,
    category: 'Lighting',
    tagline: 'CNC anodized solid brass body with 98 CRI stepless rotary dimming.',
    imageBg: 'from-amber-500/20 via-yellow-500/10 to-slate-100',
    icon: Lightbulb,
    accentColor: 'text-amber-500 bg-amber-50 border-amber-200/60',
  },
  {
    id: 'prod-3',
    name: 'Botanical Vitamin C Oil',
    sku: 'BIO-OIL-30ML',
    price: '$42.00',
    inventory: 3,
    category: 'Skincare',
    tagline: 'Bioactive rosehip seed oil with 15% THD ascorbate.',
    imageBg: 'from-emerald-500/20 via-teal-500/10 to-slate-100',
    icon: Droplets,
    accentColor: 'text-emerald-500 bg-emerald-50 border-emerald-200/60',
  },
];

const ARCHITECTURE_PILLARS = [
  {
    code: '01',
    category: 'Catalog Engine',
    title: 'Deterministic Grounding',
    subtitle: 'Zero hallucinations. Prompt tokens lock directly to verified warehouse stock and approved prices.',
    metric: '100% Fact Checked',
    icon: Database,
    spec: 'Protocol: RFC 4180 / Shopify GraphQL',
    details: 'Every promotional draft is constructed by compiling live inventory records. If SKU stock drops below warehouse thresholds, dispatch halts automatically.',
  },
  {
    code: '02',
    category: 'Data Protection',
    title: 'Enterprise-Grade Security',
    subtitle: 'Channel tokens and credentials are securely protected. Client-side leakage is strictly prevented.',
    metric: 'Full Protection',
    icon: Lock,
    spec: 'Security: Authenticated Storage Encryption',
    details: 'Security keys reside in isolated storage enclaves. Access credentials exist solely in temporary protected memory during active publishing requests.',
  },
  {
    code: '03',
    category: 'Human Governance',
    title: 'Maker-Checker Governance',
    subtitle: 'No generative draft publishes without explicit human sign-off from designated workspace administrators.',
    metric: 'Dual-Key Control',
    icon: ShieldCheck,
    spec: 'Policy: Granular Role Separation (RBAC)',
    details: 'Marketers assemble grounded campaigns; workspace administrators review locked fact anchors and approve scheduled release to social channels.',
  },
  {
    code: '04',
    category: 'Attribution Engine',
    title: 'First-Party Attribution',
    subtitle: 'Track clicks directly to checkout revenue with HMAC-verified webhooks and RFC 3986 UTM parameters.',
    metric: 'Closed-Loop ROI',
    icon: Zap,
    spec: 'Attribution: SHA-256 HMAC Signatures',
    details: 'Inbound order webhooks are cryptographically authenticated and deduplicated in Redis, mapping paid campaigns directly to verifiable cart conversions.',
  },
];

export function LandingPageV3({ onSwitchToV1 }: LandingPageV3Props) {
  const [selectedProduct, setSelectedProduct] = useState<ProductShowcase>(SHOWCASE_PRODUCTS[0]!);
  const [activeTab, setActiveTab] = useState<'instagram' | 'story' | 'linkedin'>('instagram');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does deterministic catalog grounding work?',
      a: 'Unlike generic LLMs that generate arbitrary marketing copy, NexusFlow compiles every social post by binding strictly to your live database records. If an item stock falls below threshold or a price changes in Shopify, the compiler halts dispatch.',
    },
    {
      q: 'Does NexusFlow support official publishing APIs?',
      a: 'Yes. Publishing dispatches strictly through official Meta Graph API v21.0 and LinkedIn Marketing API v2. We never use unapproved scrapers or reverse-engineered private endpoints.',
    },
    {
      q: 'How are social media OAuth credentials protected?',
      a: 'All access tokens and connection credentials are fully encrypted at rest with industry-standard protocols. Credentials exist only in temporary protected memory during active publishing.',
    },
    {
      q: 'Can I export my data or delete my workspace?',
      a: 'Yes. Under Data & Privacy, workspace owners can export full product catalogs as CSV and marketing posts as JSON anytime, or initiate an irreversible cascade purge compliant with GDPR Article 17.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] selection:bg-orange-500/20 selection:text-orange-950 font-sans antialiased overflow-x-hidden">
      <V3Navbar onSwitchToV1={onSwitchToV1} />

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden px-4 pt-10 pb-16 sm:px-6 sm:pt-16 lg:px-8 lg:pb-24">
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[480px] w-full max-w-6xl rounded-full bg-gradient-to-b from-orange-500/[0.04] via-slate-200/[0.2] to-transparent blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex justify-center mb-5">
              <BadgeGlow variant="orange" pulse={true} className="cursor-default text-xs font-mono bg-white border border-slate-200/90 text-slate-800 shadow-xs">
                <span className="text-[#FF4F17] font-semibold">ENTERPRISE COMMERCE 2026</span>
                <span className="h-3 w-px bg-slate-200 mx-1" />
                <span className="text-[#6E6E73]">Deterministic AI • Zero Hallucinations</span>
              </BadgeGlow>
            </div>

            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.035em] text-[#1D1D1F] leading-[1.05]">
              Pro Commerce Marketing. <br />
              <span className="bg-gradient-to-r from-[#1D1D1F] via-[#434347] to-[#86868B] bg-clip-text text-transparent">
                Grounded in Catalog Truth.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-[#6E6E73] leading-relaxed font-normal">
              Generic AI invents discounts, promotes dead inventory, and breaks brand compliance. NexusFlow locks every promotional asset strictly to verified warehouse facts.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link href="/register" className="w-full sm:w-auto">
                <BorderBeamButton
                  variant="default"
                  colorVariant="sunset"
                  beamSize="md"
                  className="w-full sm:w-auto text-sm px-7 py-3 rounded-full"
                >
                  <span>Start 14-Day Pilot</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </BorderBeamButton>
              </Link>
              <a
                href="#hardware-showcase"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-slate-200/90 bg-white text-sm font-semibold text-[#1D1D1F] hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
              >
                <Smartphone className="h-4 w-4 text-[#86868B]" />
                <span>Explore Campaign Studio</span>
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#6E6E73]">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Real-Time Catalog Sync
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Enterprise-Grade Security
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> Closed-Loop Revenue Attribution
              </span>
            </div>
          </div>

          {/* 3. OMNICHANNEL CAMPAIGN STUDIO SHOWCASE (BORDERLESS CLEAN APPLE LAYOUT) */}
          <div id="hardware-showcase" className="mt-14 sm:mt-24">
            <div className="relative">
              {/* Soft ambient backlight bloom behind device */}
              <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-orange-500/[0.04] via-amber-300/[0.05] to-transparent rounded-full blur-3xl -z-10" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
                {/* Left Controls & Product Selector */}
                <div className="lg:col-span-5 space-y-6 text-left">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#FF4F17] tracking-wider uppercase bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60 inline-block mb-2">
                      Omnichannel Campaign Studio
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] font-display tracking-tight">
                      Real-Time Creative Engine
                    </h2>
                    <p className="text-xs sm:text-sm text-[#6E6E73] mt-2 leading-relaxed">
                      Select a verified warehouse SKU below to observe real-time fact compilation, automated inventory triggers, and multi-channel creative generation.
                    </p>
                  </div>

                  {/* Refined Product ShiftCards with Apple Typography & Badges */}
                  <div className="space-y-3">
                    {SHOWCASE_PRODUCTS.map((prod) => {
                      const isSelected = selectedProduct.id === prod.id;
                      const Icon = prod.icon;
                      return (
                        <ShiftCard
                          key={prod.id}
                          maxTilt={2.5}
                          onClick={() => setSelectedProduct(prod)}
                          className={`p-4 rounded-2xl transition-all cursor-pointer ${
                            isSelected
                              ? 'border-orange-500/80 bg-orange-500/[0.04] ring-1 ring-orange-500/20 shadow-sm'
                              : 'border-slate-200/80 bg-white/80 text-[#1D1D1F] hover:bg-white hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${prod.accentColor}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-[#1D1D1F]">{prod.name}</p>
                                <p className="text-xs text-[#86868B] font-mono mt-0.5">{prod.sku} • {prod.category}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[#1D1D1F] font-mono">{prod.price}</p>
                              <span className="inline-block mt-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                {prod.inventory} in stock
                              </span>
                            </div>
                          </div>
                        </ShiftCard>
                      );
                    })}
                  </div>

                  {/* Channel Tab Bar with Official Cult UI HaloTabs (Pill Variant) */}
                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1D1D1F]">Simulate Channel Format:</span>
                      <span className="font-mono text-[11px] text-[#86868B]">
                        {activeTab === 'instagram' ? 'Instagram 1080×1080' : activeTab === 'story' ? 'Story 1080×1920' : 'LinkedIn Feed Card'}
                      </span>
                    </div>

                    <div className="flex items-center p-1 rounded-full bg-[#E5E5EA] border border-black/[0.04] shadow-inner w-full">
                      {(['instagram', 'story', 'linkedin'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-2 px-3 rounded-full text-xs sm:text-sm font-semibold capitalize transition-all duration-200 cursor-pointer text-center ${
                            activeTab === tab
                              ? 'bg-white text-[#1D1D1F] shadow-sm font-bold scale-[1.01]'
                              : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-[#86868B] flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Live Grounded Binding: SKU <strong>#{selectedProduct.sku}</strong> • Verified price locked</span>
                    </p>
                  </div>
                </div>

                {/* Right: The Cult UI iPhone 17 Pro Device Mockup with Authentic Light Mode Experience */}
                <div className="lg:col-span-7 flex justify-center items-center py-2">
                  <div className="w-full max-w-[340px]">
                    <IPhone17Pro
                      frameColor="silver"
                      batteryLevel={100}
                      signalStrength={4}
                      time="9:41"
                      className="shadow-[0_24px_60px_-15px_rgba(0,0,0,0.08)]"
                    >
                      {/* Inside the iPhone Screen: Authentic Light UI Experience */}
                      <div className="h-full w-full bg-[#FAFAFC] p-3.5 flex flex-col justify-between text-[#1D1D1F] font-sans text-left selection:bg-orange-500/20">
                        {activeTab === 'instagram' && (
                          <div className="space-y-3">
                            {/* Feed Header */}
                            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF4F17] to-amber-500 flex items-center justify-center text-white font-bold text-[10px] shadow-xs">
                                  NF
                                </div>
                                <div>
                                  <div className="flex items-center gap-1">
                                    <p className="text-xs font-bold text-[#1D1D1F] leading-tight">acme_commerce</p>
                                    <span className="w-3 h-3 rounded-full bg-blue-500 text-white flex items-center justify-center text-[7px] font-bold">✓</span>
                                  </div>
                                  <p className="text-[9px] text-[#86868B] leading-tight">Sponsored • Verified Grounded</p>
                                </div>
                              </div>
                              <MoreHorizontal className="w-4 h-4 text-[#86868B]" />
                            </div>

                            {/* Product Creative Card */}
                            <div className={`w-full aspect-square rounded-2xl bg-gradient-to-br ${selectedProduct.imageBg} p-4 flex flex-col justify-between relative shadow-xs overflow-hidden`}>
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[#1D1D1F] shadow-xs border border-black/[0.04]">
                                  {selectedProduct.category}
                                </span>
                                <span className="text-xs font-mono font-bold bg-[#1D1D1F] text-white px-2.5 py-1 rounded-full shadow-xs">
                                  {selectedProduct.price}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/90 font-bold px-2 py-0.5 rounded-md inline-block mb-1">
                                  Stock: {selectedProduct.inventory} Units Left
                                </span>
                                <h4 className="text-base font-extrabold text-[#1D1D1F] leading-tight font-display">
                                  {selectedProduct.name}
                                </h4>
                                <p className="text-[11px] text-[#515154] mt-0.5 line-clamp-2 leading-tight">
                                  {selectedProduct.tagline}
                                </p>
                              </div>
                            </div>

                            {/* Engagement Bar */}
                            <div className="flex items-center justify-between pt-0.5 text-[#1D1D1F]">
                              <div className="flex items-center gap-3.5">
                                <span className="flex items-center gap-1 text-xs font-semibold">
                                  <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                  <span className="text-[11px]">1.4k</span>
                                </span>
                                <span className="flex items-center gap-1 text-xs font-semibold text-[#515154]">
                                  <MessageCircle className="w-4 h-4" />
                                  <span className="text-[11px]">48</span>
                                </span>
                                <Share2 className="w-4 h-4 text-[#515154]" />
                              </div>
                              <Bookmark className="w-4 h-4 text-[#515154]" />
                            </div>

                            {/* Caption with Fact Anchors */}
                            <div className="text-xs leading-snug space-y-1">
                              <p className="text-[#1D1D1F]">
                                <strong>acme_commerce</strong> Direct warehouse release: only <strong className="text-emerald-700">{selectedProduct.inventory} items</strong> remain in stock. Locked at {selectedProduct.price}.
                              </p>
                              <p className="text-[10px] text-[#86868B] font-mono">
                                #SKU_{selectedProduct.sku} #VerifiedCatalog #InStock
                              </p>
                            </div>
                          </div>
                        )}

                        {activeTab === 'story' && (
                          <div className="h-full flex flex-col justify-between py-1">
                            {/* Story Progress Bars */}
                            <div>
                              <div className="flex items-center gap-1 mb-2.5">
                                <div className="h-1 flex-1 bg-black rounded-full" />
                                <div className="h-1 flex-1 bg-black/20 rounded-full" />
                                <div className="h-1 flex-1 bg-black/20 rounded-full" />
                              </div>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-[#FF4F17] flex items-center justify-center text-white text-[8px] font-bold">
                                    NF
                                  </div>
                                  <span className="text-xs font-bold">acme_commerce</span>
                                  <span className="text-[10px] text-[#86868B]">2h</span>
                                </div>
                              </div>
                            </div>

                            {/* Full Creative Canvas */}
                            <div className={`flex-1 rounded-2xl bg-gradient-to-br ${selectedProduct.imageBg} p-4 flex flex-col justify-between shadow-xs my-2`}>
                              <span className="text-[10px] font-bold bg-[#FF4F17] text-white px-2 py-0.5 rounded-full w-fit">
                                FLASH ALLOCATION
                              </span>
                              <div className="text-center space-y-1.5 py-4">
                                <h3 className="text-lg font-extrabold text-[#1D1D1F] font-display">
                                  {selectedProduct.name}
                                </h3>
                                <p className="text-2xl font-mono font-extrabold text-[#1D1D1F]">
                                  {selectedProduct.price}
                                </p>
                                <span className="inline-block text-[11px] font-bold text-emerald-800 bg-white/90 px-3 py-1 rounded-full shadow-xs border border-emerald-200/80">
                                  {selectedProduct.inventory} units available
                                </span>
                              </div>
                              <div className="text-center bg-white/80 backdrop-blur-md py-2 rounded-xl border border-black/5">
                                <span className="text-xs font-bold text-[#FF4F17] flex items-center justify-center gap-1">
                                  Swipe Up to Buy <ArrowRight className="w-3.5 h-3.5 -rotate-90" />
                                </span>
                              </div>
                            </div>

                            <p className="text-[10px] text-center text-[#86868B]">Verified Shopify Live Catalog Grounding</p>
                          </div>
                        )}

                        {activeTab === 'linkedin' && (
                          <div className="space-y-3">
                            {/* LinkedIn Post Header */}
                            <div className="flex items-start gap-2.5 border-b border-slate-200/80 pb-2.5">
                              <div className="w-8 h-8 rounded-md bg-[#1D1D1F] flex items-center justify-center text-white font-bold text-xs">
                                
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#1D1D1F] truncate">ACME Global Commerce</p>
                                <p className="text-[10px] text-[#86868B]">48,200 followers • Promoted</p>
                              </div>
                            </div>

                            <p className="text-xs text-[#333336] leading-relaxed">
                              Announcing guaranteed replenishment for our enterprise {selectedProduct.category.toLowerCase()} line: <strong>{selectedProduct.name}</strong>. Certified stock availability now active across North American hubs.
                            </p>

                            <div className={`rounded-xl bg-gradient-to-br ${selectedProduct.imageBg} p-3 shadow-xs`}>
                              <div className="flex items-center justify-between text-xs font-mono font-bold">
                                <span>SKU: {selectedProduct.sku}</span>
                                <span className="text-emerald-700">{selectedProduct.inventory} units in stock</span>
                              </div>
                              <p className="text-sm font-bold text-[#1D1D1F] mt-1">{selectedProduct.name}</p>
                              <p className="text-xs text-[#515154]">{selectedProduct.price} MSRP (Guaranteed)</p>
                            </div>
                          </div>
                        )}

                        {/* CTA Bar */}
                        <div className="pt-2 border-t border-slate-200/80">
                          <button
                            type="button"
                            className="w-full py-2.5 bg-[#FF4F17] hover:bg-[#E04413] text-white text-xs font-bold rounded-xl transition-all shadow-xs text-center cursor-pointer"
                          >
                            Shop Official Catalog →
                          </button>
                        </div>
                      </div>
                    </IPhone17Pro>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE 4 PILLARS OF APPLE-GRADE COMMERCE ARCHITECTURE (WITH EXPANDABLE BENTO CARDS) */}
      <section id="architecture" className="border-y border-slate-200/80 bg-[#FAFAFC] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-mono font-bold text-[#FF4F17] tracking-wider uppercase bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60 inline-block mb-2">
              Truth In Engineering
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#1D1D1F] tracking-tight">
              Architected for Reliability. Not Guesswork.
            </h2>
            <p className="mt-3 text-sm text-[#6E6E73] leading-relaxed">
              Every promotional draft is constructed by combining live warehouse inventory, cryptographic security enclaves, and strict human verification.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {ARCHITECTURE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Expandable
                  key={pillar.code}
                  expandDirection="vertical"
                  expandBehavior="push"
                >
                  {({ isExpanded }) => (
                    <ExpandableTrigger>
                      <ExpandableCard className="border border-slate-200/90 hover:border-slate-300 bg-white rounded-[2rem] p-6 shadow-[0_2px_14px_rgba(0,0,0,0.03)] hover:shadow-[0_10px_35px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between text-left cursor-pointer">
                        <ExpandableCardHeader>
                          <div className="mb-2">
                            <span className="text-[11px] font-mono font-bold text-[#FF4F17] tracking-wider uppercase bg-orange-50/90 px-2.5 py-0.5 rounded-full border border-orange-200/60 inline-block">
                              {pillar.category}
                            </span>
                          </div>
                          <h3 className="font-display text-xl font-extrabold text-[#1D1D1F] tracking-tight">{pillar.title}</h3>
                        </ExpandableCardHeader>

                        <ExpandableCardContent className="mt-2.5 flex-1">
                          <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed min-h-[48px]">{pillar.subtitle}</p>

                          {/* Interactive Expansion Trigger */}
                          <div className="mt-3.5 pt-3 border-t border-slate-100">
                            <div className="text-[11px] font-semibold text-[#1D1D1F] inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] transition-colors">
                              <span>{isExpanded ? 'Hide Specifications' : 'Inspect Technical Protocol'}</span>
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {/* Expanded Telemetry Specification */}
                          <ExpandableContent preset="fade" className="mt-3 pt-2 text-left">
                            <div className="bg-[#F5F5F7] p-3 rounded-2xl border border-black/[0.04] space-y-1.5">
                              <p className="text-[10px] font-mono font-bold text-[#FF4F17]">
                                {pillar.spec}
                              </p>
                              <p className="text-[11px] text-[#424245] leading-relaxed">
                                {pillar.details}
                              </p>
                            </div>
                          </ExpandableContent>
                        </ExpandableCardContent>

                        <ExpandableCardFooter className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-[#86868B] uppercase tracking-wider text-[10px] font-medium">Status</span>
                          <span className="text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {pillar.metric}
                          </span>
                        </ExpandableCardFooter>
                      </ExpandableCard>
                    </ExpandableTrigger>
                  )}
                </Expandable>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. VERIFIED API SPECIFICATION (CULT UI CODEBLOCK) */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-[#F5F5F7]">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <span className="text-xs font-mono text-[#FF4F17] tracking-wider uppercase font-semibold bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60 inline-block mb-2">
              Developer Contract
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] font-display tracking-tight">
              Zero-Exposure Ingestion Protocol
            </h2>
            <p className="text-xs sm:text-sm text-[#6E6E73] mt-2">
              Transmit product batches directly into your workspace. Verified by cryptographic signatures.
            </p>
          </div>

          <SpotlightCard className="p-6 border-slate-200/90 bg-white rounded-3xl shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-[#6E6E73]">
              <span className="text-[#1D1D1F] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                POST /api/v1/workspaces/:id/integrations/custom/products
              </span>
              <span className="text-emerald-600 font-semibold">200 OK</span>
            </div>
            <CodeBlock
              language="bash"
              code={`curl -X POST https://api.nexusflow.app/api/v1/workspaces/ws_01/integrations/custom/products \\
  -H "Authorization: Bearer nxf_live_••••••••" \\
  -H "Content-Type: application/json" \\
  -H "x-nexusflow-hmac: sha256_hex(payload, whsec_••••)" \\
  -d '{
    "storeName": "Flagship Tokyo Store",
    "products": [
      {
        "sourceId": "AG-RN-09",
        "title": "AeroGlide Pro Runner",
        "priceCents": 14900,
        "currency": "USD",
        "inventoryCount": 9
      }
    ]
  }'`}
            />
          </SpotlightCard>
        </div>
      </section>

      {/* 6. TRANSPARENT PRICING TIERS */}
      <section id="pricing" className="border-t border-slate-200/80 bg-[#FAFAFC] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold text-[#FF4F17] tracking-wider uppercase bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60 inline-block mb-2">
              Subscription Tiers
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#1D1D1F] tracking-tight">
              Predictable, Quota-Grounded Plans.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#6E6E73]">
              Server-enforced quotas. No variable surprise bills at the end of the month.
            </p>

            {/* Billing Toggle with Apple Solid Selected Button Background Highlight */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center p-1 rounded-full bg-[#E5E5EA] border border-black/[0.06] shadow-inner">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-[#1D1D1F] shadow-sm font-bold scale-[1.02]'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-5 py-2 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                    billingCycle === 'annual'
                      ? 'bg-white text-[#1D1D1F] shadow-sm font-bold scale-[1.02]'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  <span>Annual billing</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                      billingCycle === 'annual'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                id: 'STARTER',
                name: 'Starter Merchant',
                desc: 'For boutique brands scaling grounded promotional content.',
                monthly: 29,
                annual: 23,
                posts: '50 posts / mo',
                words: '50,000 words',
                channels: '3 accounts',
                featured: false,
              },
              {
                id: 'GROWTH',
                name: 'Growth Brand',
                desc: 'For omnichannel stores requiring multi-member governance.',
                monthly: 79,
                annual: 63,
                posts: '200 posts / mo',
                words: '200,000 words',
                channels: '10 accounts',
                featured: true,
              },
              {
                id: 'SCALE',
                name: 'Enterprise Agency',
                desc: 'High-volume quotas with dedicated SLAs and custom keys.',
                monthly: 199,
                annual: 159,
                posts: '1,000 posts / mo',
                words: '1,000,000 words',
                channels: '25 accounts',
                featured: false,
              },
            ].map((plan) => {
              const price = billingCycle === 'annual' ? plan.annual : plan.monthly;
              return (
                <SpotlightCard
                  key={plan.id}
                  spotlightColor={plan.featured ? 'rgba(255, 79, 23, 0.12)' : 'rgba(0, 0, 0, 0.04)'}
                  className={`p-7 rounded-3xl border flex flex-col justify-between transition-all relative ${
                    plan.featured
                      ? 'border-[#FF4F17] bg-white ring-1 ring-[#FF4F17]/30 shadow-lg'
                      : 'border-slate-200/80 bg-white shadow-xs'
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-[#FF4F17] text-white shadow-xs">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-mono font-bold text-[#FF4F17]">{plan.id}</span>
                    <h3 className="text-xl font-extrabold text-[#1D1D1F] font-display mt-1">{plan.name}</h3>
                    <p className="text-xs text-[#6E6E73] mt-1 min-h-[32px]">{plan.desc}</p>

                    <div className="mt-6 pb-6 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-[#1D1D1F] font-mono tracking-tight">${price}</span>
                        <span className="text-xs text-[#86868B]">/mo</span>
                      </div>
                    </div>

                    <div className="py-5 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-[#6E6E73]">
                        <span>Monthly Dispatches:</span>
                        <strong className="text-[#1D1D1F] font-mono">{plan.posts}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[#6E6E73]">
                        <span>AI Words Ceiling:</span>
                        <strong className="text-[#1D1D1F] font-mono">{plan.words}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[#6E6E73]">
                        <span>Social Accounts:</span>
                        <strong className="text-[#1D1D1F] font-mono">{plan.channels}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <div className="w-full">
                      {plan.featured ? (
                        <Link href={`/register?plan=${plan.id.toLowerCase()}`} className="w-full block group">
                          <BorderBeamButton
                            variant="default"
                            colorVariant="sunset"
                            beamSize="sm"
                            className="w-full text-xs font-bold py-3 bg-[#1D1D1F] hover:bg-black text-white shadow-sm transition-all"
                          >
                            <span>Get Started with {plan.name}</span>
                            <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                          </BorderBeamButton>
                        </Link>
                      ) : (
                        <Link href={`/register?plan=${plan.id.toLowerCase()}`} className="w-full block group">
                          <button
                            type="button"
                            className="w-full py-3 bg-[#F5F5F7] hover:bg-[#E8E8ED] active:bg-[#DFDFE4] text-[#1D1D1F] text-xs font-bold rounded-full transition-all duration-200 cursor-pointer text-center border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-sm"
                          >
                            Select {plan.name}
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. FAQS */}
      <section className="px-4 py-20 sm:px-6 lg:px-8 bg-[#F5F5F7]">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-[#FF4F17] tracking-wider uppercase font-semibold bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200/60 inline-block mb-2">
              Essential Inquiries
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] font-display tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="divide-y divide-slate-100 rounded-3xl border border-slate-200/80 bg-white px-6 shadow-xs">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={faq.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#1D1D1F] hover:text-[#FF4F17] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#86868B] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[#FF4F17]' : ''}`} />
                  </button>
                  {isOpen && <p className="mt-3 text-xs leading-relaxed text-[#6E6E73]">{faq.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. CLOSING CONVERSION SHOWPIECE */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8 bg-[#F5F5F7]">
        <SpotlightCard
          spotlightColor="rgba(255, 79, 23, 0.08)"
          className="mx-auto max-w-5xl rounded-[2.5rem] border-slate-200/90 p-8 sm:p-14 text-center shadow-lg relative overflow-hidden bg-white"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1D1D1F]">
            Elevate Your Commerce Marketing.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs sm:text-sm text-[#6E6E73] leading-relaxed">
            Join forward-thinking brands deploying deterministic, grounded campaigns that protect margins and eliminate hallucinations.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register">
              <BorderBeamButton
                variant="default"
                colorVariant="sunset"
                beamSize="md"
                className="px-8 py-3 text-sm font-bold"
              >
                <span>Start Free Workspace</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </BorderBeamButton>
            </Link>
            {onSwitchToV1 && (
              <button
                type="button"
                onClick={onSwitchToV1}
                className="px-5 py-3 rounded-full border border-slate-200 bg-[#F5F5F7] text-sm font-semibold text-[#1D1D1F] hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
              >
                <span>Classic v1</span>
              </button>
            )}
          </div>
        </SpotlightCard>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 bg-[#ECECEE] px-4 py-8 text-xs text-[#86868B] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1D1D1F] font-display">NexusFlow v3</span>
            <span>• Enterprise Grounded Commerce Marketing</span>
          </div>
          <p className="text-[11px] text-[#86868B]">
            &copy; {new Date().getFullYear()} NexusFlow CommercePilot. Grounded Catalog Intelligence &amp; Verified Attribution.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPageV3;
