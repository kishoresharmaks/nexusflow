'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth-context';
import { Lock, ShieldAlert, Sparkles, LogIn, ArrowRight } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export function ProtectedRoute({
  children,
  fallbackTitle = 'Authentication Required',
  fallbackDescription = 'Please log in to your CommercePilot account to view and manage this section.',
}: ProtectedRouteProps) {
  const { user, token, isLoading, quickDemoLogin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Verifying workspace credentials...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!token && !user) {
    return (
      <div className="min-h-[600px] flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-border/80 bg-card rounded-2xl p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{fallbackTitle}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{fallbackDescription}</p>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground text-left flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              All marketing drafts, encrypted tokens, and catalog records are protected by strict
              workspace tenant isolation.
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In to Your Workspace
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Create Free Account
            </Link>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or evaluation mode</span>
              </div>
            </div>

            <button
              onClick={() => void quickDemoLogin()}
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary/80 hover:bg-secondary px-5 py-2.5 text-xs font-semibold text-secondary-foreground transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Instant 1-Click Demo Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
