'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const { login, quickDemoLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please provide your email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      router.push(redirectPath);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Invalid credentials. Please verify and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await quickDemoLogin();
      router.push(redirectPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch demo account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-card border border-border/70 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-2 shadow-inner">
          <LogIn className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign In</h1>
        <p className="text-xs text-muted-foreground">
          Enter your credentials to access your multi-tenant CommercePilot workspace.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 flex items-start gap-3 text-destructive text-xs leading-relaxed animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-foreground">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="merchant@brand.com"
              required
              disabled={isSubmitting}
              className="w-full rounded-xl border border-input bg-background pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-foreground">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              disabled={isSubmitting}
              className="w-full rounded-xl border border-input bg-background pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 text-sm shadow hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? (
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or test instantly</span>
        </div>
      </div>

      <button
        onClick={() => void handleDemo()}
        type="button"
        disabled={isSubmitting}
        className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium py-2.5 text-xs shadow-sm hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        <Sparkles className="w-4 h-4" />
        1-Click Quick Demo Sign In
      </button>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Do not have an account yet?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create Account
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/40">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Argon2id password hashing & AES-256 encrypted tokens</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[750px] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
