import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activate Account — NexusFlow',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ActivateAccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
