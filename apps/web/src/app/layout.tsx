import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';

const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'https://nexusflow.ai';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'NexusFlow — AI Commerce Marketing Platform',
    template: '%s | NexusFlow',
  },
  description:
    'AI-powered commerce marketing SaaS connecting product catalogs to high-performing social content and verified conversions.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'NexusFlow — AI Commerce Marketing Platform',
    description:
      'Turn your store product catalog into high-converting social campaigns with AI and verified closed-loop attribution.',
    type: 'website',
    siteName: 'NexusFlow',
    url: appUrl,
    images: [
      {
        url: '/hero-dashboard.png',
        width: 1200,
        height: 630,
        alt: 'NexusFlow Platform Dashboard Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexusFlow — AI Commerce Marketing Platform',
    description:
      'Turn your store product catalog into high-converting social campaigns with AI and verified closed-loop attribution.',
    images: ['/hero-dashboard.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

import { AuthProvider } from '../context/auth-context';
import { ThemeProvider } from '../context/theme-context';
import { Navbar } from '../components/navbar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'NexusFlow',
    url: appUrl,
    description:
      'AI-powered commerce marketing SaaS connecting product catalogs to high-performing social content and verified conversions.',
  };

  // Safe serialization escaping '<' to prevent XSS in script injection
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');

  return (
    <html lang="en" className="overflow-x-hidden max-w-full w-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString }}
        />
      </head>
      <body className="min-h-screen antialiased bg-[#F7F8FA] text-[#17202A] overflow-x-hidden max-w-full w-full transition-colors duration-300">
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
