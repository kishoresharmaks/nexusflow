import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'CommercePilot — AI Commerce Marketing Platform',
  description:
    'AI-powered commerce marketing SaaS connecting product catalogs to high-performing social content and verified conversions.',
};

import { AuthProvider } from '../context/auth-context';
import { Navbar } from '../components/navbar';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-[#F7F8FA] text-[#17202A]">
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
