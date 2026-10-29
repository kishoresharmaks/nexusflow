'use client';

import React from 'react';
import { useAuth } from '../context/auth-context';
import { useTheme } from '../context/theme-context';
import { DashboardOverview } from '../components/dashboard-overview';
import { LandingPageView } from '../components/landing-page-view';
import { LandingPageV3 } from '../components/landing-page-v3';

export default function HomePage() {
  const { token } = useAuth();
  const { isV3, setTheme } = useTheme();

  if (token) {
    return <DashboardOverview />;
  }

  if (isV3) {
    return <LandingPageV3 onSwitchToV1={() => setTheme('classic')} />;
  }

  return <LandingPageView onSwitchToV3={() => setTheme('v3')} />;
}
