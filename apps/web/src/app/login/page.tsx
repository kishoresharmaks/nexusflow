'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api';
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
import { HaloInput } from '../../components/ui/halo-input';
import { HaloField, HaloFieldLabel } from '../../components/ui/halo-field';
import { HaloSwitch } from '../../components/ui/halo-switch';
import { BorderBeamButton } from '../../components/ui/border-beam-button';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const { login, quickDemoLogin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allowPublicRegistrations, setAllowPublicRegistrations] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .getPublicAuthConfig()
      .then((cfg) => {
        if (mounted) setAllowPublicRegistrations(cfg.allowPublicRegistrations);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

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
    <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-[2rem] p-6 sm:p-9 shadow-[0_4px_30px_rgba(0,0,0,0.04)] space-y-6">
      {/* Header with Apple Pro aesthetic */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white mb-2 shadow-xs">
          
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] font-display">
          Sign In
        </h1>
        <p className="text-xs text-[#6E6E73] leading-relaxed">
          Access your multi-tenant NexusFlow commerce marketing workspace.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-rose-700 text-xs leading-relaxed animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* Cult UI HaloField + HaloInput for Email */}
        <HaloField>
          <HaloFieldLabel htmlFor="email-input">Email Address</HaloFieldLabel>
          <HaloInput
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="merchant@brand.com"
            required
            disabled={isSubmitting}
            leadingSlot={<Mail className="w-4 h-4 text-[#86868B]" />}
          />
        </HaloField>

        {/* Cult UI HaloField + HaloInput for Password */}
        <HaloField>
          <div className="flex items-center justify-between">
            <HaloFieldLabel htmlFor="password-input">Password</HaloFieldLabel>
          </div>
          <HaloInput
            id="password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            disabled={isSubmitting}
            leadingSlot={<Lock className="w-4 h-4 text-[#86868B]" />}
            trailingSlot={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
        </HaloField>

        {/* Remember me toggle using Cult UI HaloSwitch */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <HaloSwitch
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked)}
              size="sm"
            />
            <span className="text-xs text-[#515154] font-medium">Keep me signed in</span>
          </label>
        </div>

        {/* Cult UI BorderBeamButton for Primary Sign In */}
        <div className="pt-2">
          <BorderBeamButton
            type="submit"
            disabled={isSubmitting}
            variant="default"
            colorVariant="sunset"
            beamSize="sm"
            className="w-full py-3 rounded-full text-sm font-bold bg-[#1D1D1F] hover:bg-black text-white shadow-xs"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </BorderBeamButton>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200/80" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2.5 text-[#86868B] font-mono text-[10px]">
            or test instantly
          </span>
        </div>
      </div>

      <button
        onClick={() => void handleDemo()}
        type="button"
        disabled={isSubmitting}
        className="w-full rounded-full border border-orange-200/80 bg-orange-50/60 hover:bg-orange-100/70 text-[#FF4F17] font-semibold py-2.5 text-xs shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>1-Click Quick Demo Sign In</span>
      </button>

      <div className="pt-1 text-center text-xs text-[#6E6E73]">
        {allowPublicRegistrations ? (
          <>
            Do not have an account yet?{' '}
            <Link href="/register" className="font-semibold text-[#FF4F17] hover:underline">
              Create Account
            </Link>
          </>
        ) : (
          <span className="text-[#86868B] text-[11px]">
            New accounts are currently by invitation only.
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[#86868B] border-t border-slate-100">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>Enterprise-grade security &amp; secure session protection</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[750px] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F5F7]">
      <Suspense
        fallback={
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#FF4F17] rounded-full animate-spin" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
