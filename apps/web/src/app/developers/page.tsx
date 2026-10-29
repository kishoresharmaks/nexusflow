'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import {
  api,
  type CustomIngestHistoryItem,
  type CustomValidationResponse,
  type CustomIngestResponse,
  type CustomProductItem,
  type CustomProductBatchPayload,
  type OrderWebhookSimulationResponse,
} from '../../lib/api';
import {
  Code2,
  Terminal,
  Copy,
  Check,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Send,
  Sparkles,
  Clock,
  Zap,
  LogIn,
  ExternalLink,
  Globe,
  Download,
  Shield,
  Key,
  ArrowUpRight,
} from 'lucide-react';

const PRESET_PAYLOADS = {
  minimal: {
    label: 'Minimal Product',
    payload: {
      products: [
        {
          sourceId: 'SKU-MIN-001',
          title: 'Premium Organic Cotton T-Shirt',
          priceCents: 2999,
          currency: 'USD',
          inventoryCount: 150,
        },
      ],
      storeName: 'Custom Store Ingestion',
    },
  },
  rich: {
    label: 'Rich Product with Images & Tags',
    payload: {
      products: [
        {
          sourceId: 'PROD-HEADPHONES-900',
          sku: 'AU-NC-09',
          title: 'Wireless Active Noise-Canceling Headphones',
          description: 'High-fidelity audio with hybrid active noise cancellation, transparency mode, and 30-hour battery life.',
          priceCents: 19900,
          currency: 'USD',
          inventoryCount: 45,
          url: 'https://store.example.com/products/noise-canceling-headphones',
          images: [
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
            'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800',
          ],
          tags: ['audio', 'wireless', 'bluetooth', 'bestseller'],
          isActive: true,
        },
      ],
      storeName: 'Flagship Headless Store',
    },
  },
  batch: {
    label: 'Multi-Product Batch',
    payload: {
      products: [
        {
          sourceId: 'MEDUSA-101',
          sku: 'MED-MUG-BLK',
          title: 'Artisanal Ceramic Coffee Mug',
          description: 'Matte black stoneware mug handmade by local ceramic artists.',
          priceCents: 2400,
          currency: 'USD',
          inventoryCount: 80,
          images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800'],
          tags: ['homeware', 'kitchen', 'ceramic'],
        },
        {
          sourceId: 'MEDUSA-102',
          sku: 'MED-BOTTLE-STEEL',
          title: 'Vacuum Insulated Stainless Water Bottle',
          description: 'Keep beverages cold for 24 hours or hot for 12 hours.',
          priceCents: 3500,
          currency: 'USD',
          inventoryCount: 120,
          images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800'],
          tags: ['outdoor', 'fitness', 'accessories'],
        },
      ],
      storeName: 'Medusa B2B Catalog',
    },
  },
  malformed: {
    label: 'Malformed Test Payload (For Error Inspection)',
    payload: {
      products: [
        {
          sourceId: '',
          title: '',
          priceCents: -500,
        },
      ],
    },
  },
};

const PRESET_WEBHOOKS = {
  shopifyClick: {
    label: 'Shopify Order Paid (with cp_click_id)',
    provider: 'shopify' as const,
    eventType: 'orders/paid',
    tamperSignature: false,
    payload: {
      id: 8492001,
      order_number: 1001,
      current_total_price: '149.50',
      total_price: '149.50',
      currency: 'USD',
      customer: {
        first_name: 'Elena',
        last_name: 'Rostova',
        email: 'elena.rostova@example.com',
      },
      landing_site:
        'https://store.example.com/products/summer-shoes?cp_click_id=60b8d29f1c9d440000a11111&utm_campaign=summer_sale&utm_source=nexusflow',
      note_attributes: [
        { name: 'cp_click_id', value: '60b8d29f1c9d440000a11111' },
        { name: 'utm_campaign', value: 'summer_sale' },
      ],
      line_items: [
        { id: 101, title: 'Summer Runner Shoes', price: '149.50', quantity: 1, sku: 'SHOES-SM-01' },
      ],
      created_at: new Date().toISOString(),
    },
  },
  shopifyUtm: {
    label: 'Shopify Order Created (with utm_campaign fallback)',
    provider: 'shopify' as const,
    eventType: 'orders/create',
    tamperSignature: false,
    payload: {
      id: 8492002,
      order_number: 1002,
      total_price: '89.00',
      currency: 'USD',
      landing_site: 'https://store.example.com/checkout?utm_campaign=summer_sale&utm_source=instagram',
      note_attributes: [{ name: 'utm_campaign', value: 'summer_sale' }],
      created_at: new Date().toISOString(),
    },
  },
  customHeadless: {
    label: 'Custom Headless Store Order (Direct Push)',
    provider: 'custom' as const,
    eventType: 'order.created',
    tamperSignature: false,
    payload: {
      orderId: 'MEDUSA-ORD-5541',
      orderTotalCents: 19900,
      currency: 'USD',
      customerEmail: 'alex@example.org',
      attribution: {
        cp_click_id: '60b8d29f1c9d440000a11111',
        utm_campaign: 'summer_sale',
        utm_source: 'linkedin',
      },
      lineItems: [
        { sku: 'AU-NC-09', title: 'Noise-Canceling Headphones', priceCents: 19900, quantity: 1 },
      ],
      occurredAt: new Date().toISOString(),
    },
  },
  woocommerce: {
    label: 'WooCommerce Order Completed',
    provider: 'woocommerce' as const,
    eventType: 'woocommerce_order_completed',
    tamperSignature: false,
    payload: {
      orderId: 'WC-88392',
      totalPrice: 125.0,
      currency: 'EUR',
      customerEmail: 'marco@example.de',
      attribution: {
        utm_campaign: 'summer_sale',
      },
      occurredAt: new Date().toISOString(),
    },
  },
  tamperedHmac: {
    label: 'Tampered Signature (Negative Security Test)',
    provider: 'shopify' as const,
    eventType: 'orders/paid',
    tamperSignature: true,
    payload: {
      id: 9999999,
      total_price: '500.00',
      currency: 'USD',
      landing_site: 'https://store.example.com/checkout?utm_campaign=summer_sale',
    },
  },
};

export type LanguageType = 'curl' | 'node' | 'python' | 'php';

export default function DevelopersPage() {
  const { currentWorkspace, token, quickDemoLogin } = useAuth();
  const workspaceId = currentWorkspace?.id || 'ws_sample_fashion_flagship';
  const isPublicViewer = !token || !currentWorkspace;

  const [activeLang, setActiveLang] = useState<LanguageType>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJsonUrl, setCopiedJsonUrl] = useState(false);

  // URL loader state
  const [urlToFetch, setUrlToFetch] = useState<string>('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlSuccessNotice, setUrlSuccessNotice] = useState<string | null>(null);

  // Sandbox state
  const [selectedPreset, setSelectedPreset] = useState<keyof typeof PRESET_PAYLOADS>('rich');
  const [jsonInput, setJsonInput] = useState<string>(
    JSON.stringify(PRESET_PAYLOADS.rich.payload, null, 2),
  );
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<CustomValidationResponse | null>(null);
  const [ingestResult, setIngestResult] = useState<CustomIngestResponse | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [publicNotice, setPublicNotice] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'catalog' | 'webhooks'>('catalog');

  // Webhook Simulator state
  const [selectedWebhookPreset, setSelectedWebhookPreset] =
    useState<keyof typeof PRESET_WEBHOOKS>('shopifyClick');
  const [webhookPayloadInput, setWebhookPayloadInput] = useState<string>(
    JSON.stringify(PRESET_WEBHOOKS.shopifyClick.payload, null, 2),
  );
  const [webhookProvider, setWebhookProvider] = useState<'shopify' | 'custom' | 'woocommerce'>('shopify');
  const [webhookEventType, setWebhookEventType] = useState('orders/paid');
  const [webhookSecret, setWebhookSecret] = useState('nexus_whsec_live_99281');
  const [tamperSignature, setTamperSignature] = useState(false);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);
  const [webhookSimulationResult, setWebhookSimulationResult] =
    useState<OrderWebhookSimulationResponse | null>(null);
  const [webhookErrorNotice, setWebhookErrorNotice] = useState<string | null>(null);
  const [copiedWebhookSnippet, setCopiedWebhookSnippet] = useState(false);
  const [webhookLang, setWebhookLang] = useState<LanguageType>('curl');

  const handleSelectWebhookPreset = (key: keyof typeof PRESET_WEBHOOKS) => {
    setSelectedWebhookPreset(key);
    const item = PRESET_WEBHOOKS[key];
    setWebhookPayloadInput(JSON.stringify(item.payload, null, 2));
    setWebhookProvider(item.provider);
    setWebhookEventType(item.eventType);
    setTamperSignature(!!item.tamperSignature);
    setWebhookErrorNotice(null);
  };

  const handleSimulateWebhook = async () => {
    setIsSimulatingWebhook(true);
    setWebhookErrorNotice(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(webhookPayloadInput) as Record<string, unknown>;
    } catch {
      setWebhookErrorNotice('Invalid JSON format: please verify your order payload.');
      setIsSimulatingWebhook(false);
      return;
    }

    if (currentWorkspace) {
      try {
        const res = await api.simulateOrderWebhook(currentWorkspace.id, {
          provider: webhookProvider,
          eventType: webhookEventType,
          payload: parsed,
          secret: webhookSecret,
          tamperSignature,
        });
        setWebhookSimulationResult(res);
      } catch (err) {  
        setWebhookErrorNotice(
          err instanceof Error ? err.message : 'Order webhook simulation failed.',
        );
      } finally {
        setIsSimulatingWebhook(false);
      }
      return;
    }

    // Public Guest Sandbox Simulation
    setTimeout(() => {
      const orderId = String(parsed['id'] || parsed['orderId'] || 'ORD-PUBLIC-DEMO');
      const rawTotal = parsed['total_price'] || parsed['orderTotalCents'] || '149.50';
      const orderTotalCents = typeof rawTotal === 'number' && rawTotal > 1000 ? rawTotal : Math.round(parseFloat(String(rawTotal)) * 100);
      const currency = String(parsed['currency'] || 'USD').toUpperCase();

      if (tamperSignature) {
        setWebhookSimulationResult({
          success: false,
          httpStatus: 401,
          provider: webhookProvider,
          eventType: webhookEventType,
          orderId,
          hmacSignature: 'invalid_tampered_hmac_sha256_digest_xyz',
          hmacValid: false,
          idempotencyStatus: 'failed',
          orderTotalCents: 0,
          currency,
          attribution: {},
          error: 'Invalid cryptographic HMAC signature. Request rejected at security boundary.',
          message: 'HMAC signature verification failed. The payload or secret key did not match the computed digest.',
        });
      } else {
        setWebhookSimulationResult({
          success: true,
          httpStatus: 200,
          provider: webhookProvider,
          eventType: webhookEventType,
          orderId,
          hmacSignature: 'hmac_sha256_f8a920b7218ac90184b2e10499281a9',
          hmacValid: true,
          idempotencyStatus: 'processed',
          orderTotalCents,
          currency,
          attribution: {
            campaignId: 'camp-demo-summer',
            campaignName: 'Summer Launch 2026',
            source: 'click:60b8d29f1c9d440000a11111',
          },
          message: `Order ${orderId} successfully verified via HMAC-SHA256 and credited to campaign 'Summer Launch 2026' ($${(orderTotalCents / 100).toFixed(2)} ${currency}).`,
        });
      }
      setIsSimulatingWebhook(false);
    }, 400);
  };

  // Ingestion history
  const [history, setHistory] = useState<CustomIngestHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!currentWorkspace) {
      setLoadingHistory(false);
      return;
    }
    setLoadingHistory(true);
    try {
      const items = await api.getCustomIngestHistory(currentWorkspace.id);
      setHistory(items);
    } catch {
      // Non-blocking
    } finally {
      setLoadingHistory(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (currentWorkspace) {
      void loadHistory();
    } else {
      setLoadingHistory(false);
    }
  }, [currentWorkspace, loadHistory]);

  const handlePresetChange = (preset: keyof typeof PRESET_PAYLOADS) => {
    setSelectedPreset(preset);
    setJsonInput(JSON.stringify(PRESET_PAYLOADS[preset].payload, null, 2));
    setValidationResult(null);
    setIngestResult(null);
    setErrorNotice(null);
    setPublicNotice(null);
  };

  const handleValidate = async (inputOverride?: string) => {
    setIsValidating(true);
    setErrorNotice(null);
    setPublicNotice(null);
    setIngestResult(null);

    const rawToParse = inputOverride !== undefined ? inputOverride : jsonInput;
    let parsed: { products?: unknown[]; storeName?: string };
    try {
      parsed = JSON.parse(rawToParse);
    } catch (e) {
      setErrorNotice(`JSON Syntax Error: ${(e as Error).message}`);
      setIsValidating(false);
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      setErrorNotice('Invalid JSON payload: root must be an object with a "products" array.');
      setIsValidating(false);
      return;
    }

    // If authenticated, execute live API validation
    if (currentWorkspace) {
      try {
        const res = await api.validateCustomPayload(currentWorkspace.id, parsed);
        setValidationResult(res);
      } catch (err) {  
        setErrorNotice(err instanceof Error ? err.message : 'Validation request failed.');
      } finally {
        setIsValidating(false);
      }
      return;
    }

    // Public Viewer Mode: Perform client-side schema validation
    setTimeout(() => {
      const errors: string[] = [];
      const products = Array.isArray(parsed.products) ? parsed.products : [];

      if (!products.length) {
        errors.push('Payload must contain a non-empty `products` array.');
      }

      const sample: CustomValidationResponse['sample'] = [];

      products.forEach((p: unknown, idx: number) => {
        if (!p || typeof p !== 'object') {
          errors.push(`Product at index [${idx}] is not an object.`);
          return;
        }
        const item = p as Record<string, unknown>;
        if (!item.sourceId || typeof item.sourceId !== 'string' || !item.sourceId.trim()) {
          errors.push(`Product [${idx}]: missing required string "sourceId".`);
        }
        if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
          errors.push(`Product [${idx}]: missing required string "title".`);
        }
        if (typeof item.priceCents !== 'number' || item.priceCents < 0) {
          errors.push(`Product [${idx}]: "priceCents" must be a non-negative integer.`);
        }
        if (idx < 3) {
          sample.push({
            sourceId: String(item.sourceId || `SKU-${idx}`),
            title: String(item.title || 'Untitled Product'),
            priceCents: typeof item.priceCents === 'number' ? item.priceCents : 0,
            currency: String(item.currency || 'USD'),
            inventoryCount: typeof item.inventoryCount === 'number' ? item.inventoryCount : 0,
            images: Array.isArray(item.images) ? item.images.map(String) : [],
            tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          });
        }
      });

      setValidationResult({
        valid: errors.length === 0,
        normalizedCount: products.length,
        errors,
        sample,
      });
      setIsValidating(false);
    }, 250);
  };

  const handleSubmitIngest = async () => {
    setErrorNotice(null);
    setIngestResult(null);

    let parsed: { products?: unknown[]; storeName?: string };
    try {
      parsed = JSON.parse(jsonInput);
    } catch (e) {
      setErrorNotice(`JSON Syntax Error: ${(e as Error).message}`);
      return;
    }

    // If unauthenticated public visitor: prompt with guidance
    if (isPublicViewer) {
      setPublicNotice(
        'Public Mode: Payload is formatted properly! To ingest live products into your store catalog and launch social campaigns, please sign in or try the 1-Click Demo.',
      );
      return;
    }

    if (!currentWorkspace) return;

    setIsSubmitting(true);
    try {
      const payload: CustomProductBatchPayload = {
        products: (Array.isArray(parsed.products)
          ? parsed.products
          : Array.isArray(parsed)
            ? parsed
            : []) as unknown as CustomProductItem[],
        storeName: (parsed.storeName as string) || 'Custom Store Developer Sandbox',
      };

      if (!payload.products || payload.products.length === 0) {
        setErrorNotice('Payload must contain a non-empty `products` array.');
        setIsSubmitting(false);
        return;
      }

      const res = await api.ingestCustomProducts(currentWorkspace.id, payload);
      setIngestResult(res);
      await loadHistory();
    } catch (err) {  
      setErrorNotice(err instanceof Error ? err.message : 'Ingest request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const endpointUrl = `${api.getBaseUrl()}/workspaces/${workspaceId}/integrations/custom/products`;

  const hostedSampleJsonUrl = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
    ? `${window.location.origin}/sample-catalog.json`
    : '/sample-catalog.json';

  const handleFetchFromUrl = async (urlOverride?: string) => {
    
    const targetUrl = (urlOverride?.trim() || urlToFetch.trim() || hostedSampleJsonUrl.trim());
    if (!targetUrl) return;

    setIsFetchingUrl(true);
    setErrorNotice(null);
    setUrlSuccessNotice(null);

    try {
      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      
      const data = (await res.json()) as unknown;
      
      const formatted = JSON.stringify(data, null, 2);
      setJsonInput(formatted);
      setUrlSuccessNotice(`Successfully loaded live catalog JSON feed from: ${targetUrl}`);
      void handleValidate(formatted);
    } catch (err) {  
      setErrorNotice(
        `Failed to fetch JSON from "${targetUrl}": ${err instanceof Error ? err.message : 'Network error or CORS restriction'}`
      );
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const getCodeSnippet = (lang: LanguageType) => {
    const sampleBody = JSON.stringify(
      {
        products: [
          {
            sourceId: 'SKU-001',
            title: 'Wireless Studio Headphones',
            priceCents: 14999,
            currency: 'USD',
            inventoryCount: 50,
          },
        ],
        storeName: 'My Custom Storefront',
      },
      null,
      2,
    );

    const tokenPlaceholder = token ? 'YOUR_JWT_TOKEN' : 'nxf_live_sample_token_8829...';

    switch (lang) {
      case 'curl':
        return `curl -X POST "${endpointUrl}" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '${sampleBody.replace(/\n/g, '\n  ')}'`;

      case 'node':
        return `import fetch from 'node-fetch';

const response = await fetch('${endpointUrl}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${tokenPlaceholder}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(${sampleBody.replace(/\n/g, '\n  ')}),
});

const result = await response.json();
console.log('Ingest Result:', result);`;

      case 'python':
        return `import requests

url = "${endpointUrl}"
headers = {
    "Authorization": "Bearer ${tokenPlaceholder}",
    "Content-Type": "application/json"
}
payload = ${sampleBody.replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())`;

      case 'php':
        return `<?php
$curl = curl_init();

$payload = json_encode(${sampleBody});

curl_setopt_array($curl, [
  CURLOPT_URL => "${endpointUrl}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer ${tokenPlaceholder}",
    "Content-Type: application/json"
  ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;`;
    }
  };

  const copyToClipboard = (text: string, isSnippet = false, isJsonUrl = false) => {
    void navigator.clipboard.writeText(text);
    if (isSnippet) {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else if (isJsonUrl) {
      setCopiedJsonUrl(true);
      setTimeout(() => setCopiedJsonUrl(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const getWebhookCodeSnippet = (lang: LanguageType) => {
    const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/v1/workspaces/${workspaceId}/integrations/custom/orders`;
    const sampleBody = webhookPayloadInput;
    const secret = webhookSecret;

    switch (lang) {
      case 'curl':
        return `# 1. Calculate HMAC-SHA256 signature in bash/openssl:
SIGNATURE=$(echo -n '${sampleBody.replace(/\n/g, '')}' | openssl dgst -sha256 -hmac "${secret}" | sed 's/^.* //')

# 2. Dispatch Order Webhook Callback to NexusFlow:
curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-NexusFlow-Hmac: $SIGNATURE" \\
  -d '${sampleBody.replace(/\n/g, '\n  ')}'`;

      case 'node':
        return `import crypto from 'crypto';
import fetch from 'node-fetch';

const secret = '${secret}';
const body = JSON.stringify(${sampleBody.replace(/\n/g, '\n  ')});
const signature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');

const response = await fetch('${webhookUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-NexusFlow-Hmac': signature,
  },
  body,
});

const result = await response.json();
console.log('Attribution Result:', result);`;

      case 'python':
        return `import hmac
import hashlib
import json
import requests

secret = b"${secret}"
payload = json.dumps(${sampleBody.replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')})
signature = hmac.new(secret, payload.encode('utf-8'), hashlib.sha256).hexdigest()

headers = {
    "Content-Type": "application/json",
    "X-NexusFlow-Hmac": signature
}

res = requests.post("${webhookUrl}", data=payload, headers=headers)
print(res.status_code, res.json())`;

      case 'php':
        return `<?php
$secret = '${secret}';
$payload = json_encode(${sampleBody});
$signature = hash_hmac('sha256', $payload, $secret);

$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => "${webhookUrl}",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_POSTFIELDS => $payload,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "X-NexusFlow-Hmac: " . $signature
  ],
]);

$response = curl_exec($curl);
curl_close($curl);
echo $response;`;
    }
  };

  const copyWebhookSnippet = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedWebhookSnippet(true);
    setTimeout(() => setCopiedWebhookSnippet(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-7xl space-y-8 font-sans">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to NexusFlow Home
        </Link>

        {isPublicViewer && (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign In</span>
            </Link>
            <button
              type="button"
              onClick={() => void quickDemoLogin()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-[#FF4F17] border border-orange-200/80 hover:bg-orange-100/70 transition-all shadow-2xs cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>1-Click Demo</span>
            </button>
          </div>
        )}
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Code2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 font-display">
              Custom Store Developer Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
              REST Push API v1
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Public Documentation
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
            Integrate custom ecommerce platforms, headless frontends, ERPs, or internal catalogs directly into NexusFlow via standard REST endpoints with deterministic stock and price grounding.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-700 shadow-2xs">
            <span className="text-slate-400 font-sans font-semibold mr-1">Workspace ID:</span>
            <span className="font-bold text-slate-900">{workspaceId}</span>
          </div>
        </div>
      </div>

      {/* Public Visitor Notice Banner */}
      {isPublicViewer && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200/80 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Public Developer Documentation &amp; Sandbox.</span>
              <span className="text-blue-700 ml-1">
                You can inspect endpoints, generate code snippets, and validate payload schemas without logging in.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void quickDemoLogin()}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Launch Live Workspace Demo
            </button>
          </div>
        </div>
      )}

      {/* Primary Feature Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#FF4F17] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Product Catalog Ingestion</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === 'webhooks'
              ? 'bg-[#FF4F17] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>Order Webhook Simulator</span>
        </button>
      </div>

      {activeTab === 'catalog' && (
        <div className="space-y-8">
      {/* Section 1: Endpoint & Code Snippets */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#FF4F17]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Push Ingestion Endpoint</h2>
              <p className="text-xs text-slate-500">Send JSON product batches via standard HTTP POST</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200/60">
            {(['curl', 'node', 'python', 'php'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLang(lang)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeLang === lang
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'curl' ? 'cURL' : lang === 'node' ? 'Node.js' : lang === 'python' ? 'Python' : 'PHP'}
              </button>
            ))}
          </div>
        </div>

        {/* Live URL Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200">
              POST
            </span>
            <span className="truncate text-slate-800 select-all font-semibold">{endpointUrl}</span>
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(endpointUrl)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition-all cursor-pointer"
          >
            {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedUrl ? 'Copied URL' : 'Copy Endpoint URL'}
          </button>
        </div>

        {/* Live Hosted JSON Feed Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200/80 text-xs font-mono">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-[#FF4F17] font-bold text-[11px] border border-orange-200">
              GET JSON
            </span>
            <span className="truncate text-slate-800 select-all font-semibold">{hostedSampleJsonUrl}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={hostedSampleJsonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-orange-200 bg-white text-xs font-semibold text-[#FF4F17] hover:bg-orange-50 shadow-2xs transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Raw JSON</span>
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(hostedSampleJsonUrl, false, true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition-all cursor-pointer"
            >
              {copiedJsonUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedJsonUrl ? 'Copied' : 'Copy JSON URL'}
            </button>
            <button
              type="button"
              disabled={isFetchingUrl}
              onClick={() => void handleFetchFromUrl(hostedSampleJsonUrl)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FF4F17] text-white hover:bg-[#e04413] text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFetchingUrl ? 'Loading...' : 'Load JSON to Sandbox'}</span>
            </button>
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="relative rounded-2xl bg-slate-900 p-5 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
          <button
            type="button"
            onClick={() => copyToClipboard(getCodeSnippet(activeLang), true)}
            className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white hover:bg-slate-700 text-[11px] font-sans font-semibold transition-all cursor-pointer"
          >
            {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedSnippet ? 'Copied' : 'Copy Code'}
          </button>
          <pre className="pr-24 leading-relaxed font-mono">{getCodeSnippet(activeLang)}</pre>
        </div>
      </section>

      {/* Section 2: Interactive Sandbox */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Interactive Ingestion Sandbox</h2>
              <p className="text-xs text-slate-500">
                Validate payload structure or test ingest products directly into your workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Presets:</span>
            {(['minimal', 'rich', 'batch', 'malformed'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handlePresetChange(k)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedPreset === k
                    ? 'bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] text-white shadow-2xs font-bold'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {PRESET_PAYLOADS[k].label}
              </button>
            ))}
            <button
              type="button"
              disabled={isFetchingUrl}
              onClick={() => void handleFetchFromUrl(hostedSampleJsonUrl)}
              className="px-3 py-1 rounded-full text-xs font-semibold border border-orange-200 bg-orange-50 text-[#FF4F17] hover:bg-orange-100 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <Download className="w-3 h-3" />
              <span>{isFetchingUrl ? 'Loading Feed...' : 'Hosted Feed (/sample-catalog.json)'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Hosted JSON URL Loader Bar */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>Load Catalog JSON from Hosted URL</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setUrlToFetch(hostedSampleJsonUrl);
                void handleFetchFromUrl(hostedSampleJsonUrl);
              }}
              className="text-[11px] font-bold text-[#FF4F17] hover:underline cursor-pointer"
            >
              Use Hosted Sample Feed (/sample-catalog.json)
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={urlToFetch}
              onChange={(e) => setUrlToFetch(e.target.value)}
              placeholder={`e.g. ${hostedSampleJsonUrl} or https://your-store.com/products.json`}
              className="w-full font-mono text-xs px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF4F17]/20 focus:border-[#FF4F17]"
            />
            <button
              type="button"
              disabled={isFetchingUrl}
              onClick={() => void handleFetchFromUrl()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFetchingUrl ? 'Fetching...' : 'Fetch & Load JSON'}</span>
            </button>
          </div>
          {urlSuccessNotice && (
            <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 pt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{urlSuccessNotice}</span>
            </div>
          )}
        </div>

        {/* JSON Editor Box */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              JSON Request Body (editable)
            </label>
            <textarea
              rows={12}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full font-mono text-xs p-4 rounded-2xl border border-slate-300 bg-slate-50/70 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF4F17]/20 focus:border-[#FF4F17] shadow-inner"
            />
          </div>

          {errorNotice && (
            <div role="alert" className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {publicNotice && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{publicNotice}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shadow-xs"
                >
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => void quickDemoLogin()}
                  className="px-3 py-1.5 rounded-xl bg-white border border-blue-300 text-blue-700 font-bold text-xs hover:bg-blue-50 transition-all shadow-2xs"
                >
                  1-Click Demo
                </button>
              </div>
            </div>
          )}

          {validationResult && (
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${validationResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <div className="flex items-center gap-2 font-bold">
                {validationResult.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                <span>
                  {validationResult.valid
                    ? `Payload Validated: ${validationResult.normalizedCount} product(s) ready for ingest`
                    : 'Validation Warnings Detected'}
                </span>
              </div>
              {validationResult.errors.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800">
                  {validationResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
              {validationResult.sample.length > 0 && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px]">
                  <span className="font-semibold">Normalized Preview:</span>{' '}
                  {validationResult.sample.map((s) => `${s.title} ($${(s.priceCents / 100).toFixed(2)})`).join(', ')}
                </div>
              )}
            </div>
          )}

          {ingestResult && (
            <div role="status" className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ingestion Successful</span>
              </div>
              <p className="text-xs text-emerald-800">{ingestResult.message}</p>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px]">
                <span className="font-semibold">Created: {ingestResult.created}</span>
                <span className="font-semibold">Updated: {ingestResult.updated}</span>
                <Link href="/catalog" className="font-bold underline text-emerald-900 hover:text-emerald-700">
                  View in Catalog &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => void handleValidate()}
              disabled={isValidating || isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-blue-600" />
              {isValidating ? 'Validating…' : 'Validate Schema'}
            </button>
            <button
              type="button"
              onClick={() => void handleSubmitIngest()}
              disabled={isValidating || isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] hover:from-[#E8430D] hover:to-[#EB531B] text-white text-xs font-bold shadow-md shadow-[#FF4F17]/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Ingesting to Workspace…' : isPublicViewer ? 'Test Ingest Payload' : 'Submit Ingest to Workspace'}
            </button>
          </div>
        </div>
      </section>

      {/* Section 3: Catalog Field Specification Table */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Catalog Field Specification</h2>
            <p className="text-xs text-slate-500">Full parameter schema for REST ingestion batches</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-3 px-3.5 font-bold">Field</th>
                <th className="py-3 px-3.5 font-bold">Type</th>
                <th className="py-3 px-3.5 font-bold">Required</th>
                <th className="py-3 px-3.5 font-bold">Default</th>
                <th className="py-3 px-3.5 font-bold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">sourceId</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string</td>
                <td className="py-3 px-3.5 font-bold text-rose-600">Yes</td>
                <td className="py-3 px-3.5 text-slate-400">—</td>
                <td className="py-3 px-3.5">Unique identifier in your external ecommerce database (e.g. SKU or product UUID).</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">title</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string</td>
                <td className="py-3 px-3.5 font-bold text-rose-600">Yes</td>
                <td className="py-3 px-3.5 text-slate-400">—</td>
                <td className="py-3 px-3.5">Product title used deterministically for AI draft copy and marketing claims.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">priceCents</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">integer</td>
                <td className="py-3 px-3.5 font-bold text-rose-600">Yes</td>
                <td className="py-3 px-3.5 text-slate-400">—</td>
                <td className="py-3 px-3.5">Price in minor currency units (e.g. 2999 = $29.99). Enforces price accuracy.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">currency</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 font-mono text-[11px]">USD</td>
                <td className="py-3 px-3.5">3-letter ISO-4217 currency code (e.g. USD, EUR, GBP, INR).</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">inventoryCount</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">integer</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 font-mono text-[11px]">0</td>
                <td className="py-3 px-3.5">Stock quantity. Items with zero inventory trigger automated marketing pause alerts.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">sku</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 text-slate-400">—</td>
                <td className="py-3 px-3.5">Merchant stock keeping unit for inventory matching.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">description</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 text-slate-400">—</td>
                <td className="py-3 px-3.5">Product description and specs used to ground AI copy factuality.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">url</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 text-slate-400">—</td>
                <td className="py-3 px-3.5">Storefront product URL used for automated UTM campaign link generation.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">images</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string[]</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 font-mono text-[11px]">[]</td>
                <td className="py-3 px-3.5">Array of image URLs attached to auto-generated social posts and carousels.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-3 px-3.5 font-mono font-bold text-slate-900">tags</td>
                <td className="py-3 px-3.5 font-mono text-[11px] text-slate-500">string[]</td>
                <td className="py-3 px-3.5 text-slate-500">No</td>
                <td className="py-3 px-3.5 font-mono text-[11px]">[]</td>
                <td className="py-3 px-3.5">Taxonomy tags used for caption hashtag suggestions and campaign targeting.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4: Recent Ingestion Event Log (Only for Authenticated Workspaces) */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Ingestion Events</h2>
              <p className="text-xs text-slate-500">Audit history of catalog batch pushes into this workspace</p>
            </div>
          </div>
          {currentWorkspace && (
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loadingHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} /> Refresh
            </button>
          )}
        </div>

        {isPublicViewer ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Live Ingestion History Requires an Active Workspace</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Sign in with your merchant account or launch the 1-Click Demo to push products to a database and track sync audit records.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] text-white font-bold text-xs shadow-sm shadow-[#FF4F17]/20"
              >
                <span>Sign In to Access Fleet History</span>
              </Link>
            </div>
          </div>
        ) : loadingHistory ? (
          <p className="text-xs text-slate-500 py-6 text-center">Loading ingestion history…</p>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
            No custom store ingestion events recorded yet. Use the Sandbox above or submit via cURL to start.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-3 px-3.5 font-bold">Timestamp</th>
                  <th className="py-3 px-3.5 font-bold">Source Name</th>
                  <th className="py-3 px-3.5 font-bold">Products Ingested</th>
                  <th className="py-3 px-3.5 font-bold">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-900">{item.storeName}</td>
                    <td className="py-3 px-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {item.total} items ({item.created} new, {item.updated} updated)
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-slate-500">
                      {item.actor ? `${item.actor.name} (${item.actor.email})` : 'System / API'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </div>
      )}

      {activeTab === 'webhooks' && (
        <div className="space-y-8">
          {/* Section 1: Order Webhook Endpoint & Cryptographic Snippet */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Order Webhook Ingestion &amp; Attribution Endpoint</h2>
                  <p className="text-xs text-slate-500">Receive store order callbacks with HMAC-SHA256 signature verification</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200/60">
                {(['curl', 'node', 'python', 'php'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setWebhookLang(lang)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      webhookLang === lang
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'node' ? 'Node.js' : lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* URL Display */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono gap-3 shadow-inner">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  POST
                </span>
                <span className="truncate text-slate-300">
                  {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/v1/workspaces/{workspaceId}/integrations/custom/orders
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/v1/workspaces/${workspaceId}/integrations/custom/orders`,
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0 cursor-pointer"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied' : 'Copy Endpoint'}</span>
              </button>
            </div>

            {/* Code Snippet Box */}
            <div className="relative group">
              <pre className="p-4 bg-slate-950 text-slate-200 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 shadow-sm">
                <code>{getWebhookCodeSnippet(webhookLang)}</code>
              </pre>
              <button
                type="button"
                onClick={() => copyWebhookSnippet(getWebhookCodeSnippet(webhookLang))}
                className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-sans font-medium transition-all shadow-sm border border-slate-700/60 cursor-pointer backdrop-blur-xs"
              >
                {copiedWebhookSnippet ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedWebhookSnippet ? 'Copied Code' : 'Copy'}</span>
              </button>
            </div>
          </section>

          {/* Section 2: Interactive Webhook Simulator Console */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Interactive Order Webhook Simulator</h2>
                <p className="text-xs text-slate-500">
                  Simulate external order callbacks, sign with HMAC-SHA256, test attribution, and inspect idempotency
                </p>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Test Presets:</span>
                {(Object.keys(PRESET_WEBHOOKS) as Array<keyof typeof PRESET_WEBHOOKS>).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectWebhookPreset(key)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      selectedWebhookPreset === key
                        ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {PRESET_WEBHOOKS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulator Configuration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Provider Adapter</label>
                <select
                  value={webhookProvider}
                  onChange={(e) =>
                    setWebhookProvider(e.target.value as 'shopify' | 'custom' | 'woocommerce')
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="shopify">Shopify Webhooks</option>
                  <option value="custom">Custom Headless / ERP</option>
                  <option value="woocommerce">WooCommerce Webhooks</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Webhook Secret Key</label>
                <div className="relative">
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="whsec_..."
                  />
                  <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="tamperSigCheckbox"
                  checked={tamperSignature}
                  onChange={(e) => setTamperSignature(e.target.checked)}
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="tamperSigCheckbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Corrupt Signature (Test 401 Rejection)
                </label>
              </div>
            </div>

            {webhookErrorNotice && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{webhookErrorNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWebhookErrorNotice(null)}
                  className="font-bold underline ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Split Screen: Payload Editor & Real-Time Diagnostic Result */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Editable Payload */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Raw Order Webhook Payload (JSON)</span>
                  <span className="text-[11px] text-slate-500 font-mono">Editable</span>
                </div>
                <textarea
                  value={webhookPayloadInput}
                  onChange={(e) => setWebhookPayloadInput(e.target.value)}
                  rows={14}
                  className="w-full p-4 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF4F17] leading-relaxed shadow-inner"
                  spellCheck={false}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSimulateWebhook()}
                    disabled={isSimulatingWebhook}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-[#FF4F17] to-[#FF5E24] hover:from-[#E8430D] hover:to-[#EB531B] text-white font-bold text-xs shadow-md shadow-[#FF4F17]/25 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSimulatingWebhook ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-white" />
                    )}
                    <span>{isSimulatingWebhook ? 'Executing Callback…' : 'Simulate Order Webhook'}</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Diagnostic Inspection Result */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700">Attribution &amp; Signature Diagnostics</span>

                {webhookSimulationResult ? (
                  <div
                    className={`p-5 rounded-2xl border space-y-4 ${
                      webhookSimulationResult.success
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-red-50/50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                      <div className="flex items-center gap-2">
                        {webhookSimulationResult.success ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        <span className="text-sm font-bold text-slate-900">
                          {webhookSimulationResult.success
                            ? 'Webhook Verified & Processed'
                            : 'Webhook Rejected'}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          webhookSimulationResult.httpStatus === 200
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        HTTP {webhookSimulationResult.httpStatus}
                      </span>
                    </div>

                    {/* Cryptographic Verification */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-600">HMAC-SHA256 Signature:</span>
                        <span
                          className={`font-bold ${
                            webhookSimulationResult.hmacValid ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {webhookSimulationResult.hmacValid ? '✓ Valid Cryptographic Match' : '✗ Signature Mismatch'}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100 font-mono text-[11px] text-slate-700 break-all border border-slate-200">
                        {webhookSimulationResult.hmacSignature}
                      </div>
                    </div>

                    {/* Idempotency & Attribution */}
                    <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-[11px] font-semibold text-slate-500 block">Idempotency Guard</span>
                        <span className="font-bold text-slate-900 capitalize">
                          {webhookSimulationResult.idempotencyStatus === 'processed'
                            ? 'New Conversion'
                            : webhookSimulationResult.idempotencyStatus === 'already_processed'
                              ? 'Duplicate Suppressed'
                              : 'Failed'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-white border border-slate-200/80">
                        <span className="text-[11px] font-semibold text-slate-500 block">Credited Revenue</span>
                        <span className="font-bold text-slate-900">
                          {webhookSimulationResult.currency} ${(webhookSimulationResult.orderTotalCents / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Attribution Target */}
                    {webhookSimulationResult.attribution && (
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-600">Attributed Campaign:</span>
                          <span className="font-bold text-indigo-700">
                            {webhookSimulationResult.attribution.campaignName || 'Direct Store Traffic'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span>Attribution Source:</span>
                          <span className="font-mono text-slate-700">
                            {webhookSimulationResult.attribution.source || 'direct'}
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {webhookSimulationResult.message}
                    </p>

                    {webhookSimulationResult.success && (
                      <div className="pt-1 flex items-center gap-2">
                        <Link
                          href="/analytics"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#FF4F17] hover:underline"
                        >
                          <span>View in Analytics Hub</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <span className="text-slate-300">•</span>
                        <Link
                          href="/campaigns"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#FF4F17] hover:underline"
                        >
                          <span>View Marketing Campaigns</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 text-center space-y-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-800">No Webhook Simulation Run Yet</div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Select a preset on the left or customize your order payload, then click &quot;Simulate Order Webhook&quot; to test cryptographic verification and closed-loop attribution.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Webhook Attribution Field Specification */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Order Webhook Attribution Specification</h2>
                <p className="text-xs text-slate-500">Payload fields and headers required for verified multi-channel ROI attribution</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-3.5 font-bold">Field / Header</th>
                    <th className="py-3 px-3.5 font-bold">Type</th>
                    <th className="py-3 px-3.5 font-bold">Required</th>
                    <th className="py-3 px-3.5 font-bold">Attribution Role &amp; Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">X-Shopify-Hmac-Sha256 / X-NexusFlow-Hmac</td>
                    <td className="py-3 px-3.5 text-slate-500 font-mono">string (base64 / hex)</td>
                    <td className="py-3 px-3.5 font-bold text-emerald-700">Required (Prod)</td>
                    <td className="py-3 px-3.5">
                      Cryptographic HMAC-SHA256 signature calculated over the raw JSON payload with constant-time verification.
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">order_id / orderId</td>
                    <td className="py-3 px-3.5 text-slate-500 font-mono">string | number</td>
                    <td className="py-3 px-3.5 font-bold text-emerald-700">Required</td>
                    <td className="py-3 px-3.5">
                      Unique store order ID. Enforces idempotency to guarantee duplicate webhooks never double-count revenue.
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">current_total_price / orderTotalCents</td>
                    <td className="py-3 px-3.5 text-slate-500 font-mono">string | number</td>
                    <td className="py-3 px-3.5 font-bold text-emerald-700">Required</td>
                    <td className="py-3 px-3.5">
                      Gross order revenue credited to campaign analytics and aggregated daily reporting.
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">cp_click_id / clickId</td>
                    <td className="py-3 px-3.5 text-slate-500 font-mono">string (ObjectId)</td>
                    <td className="py-3 px-3.5 font-semibold text-amber-600">Recommended</td>
                    <td className="py-3 px-3.5">
                      First-touch click identifier passed in query parameter or cart note attributes. Resolves deterministic 1:1 attribution.
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900">utm_campaign</td>
                    <td className="py-3 px-3.5 text-slate-500 font-mono">string</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-500">Optional</td>
                    <td className="py-3 px-3.5">
                      Fallback campaign identifier matched when individual click token is expired or unavailable.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}















