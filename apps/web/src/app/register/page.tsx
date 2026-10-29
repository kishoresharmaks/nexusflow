'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { api } from '../../lib/api';
import {
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  Building2,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Ticket,
} from 'lucide-react';
import { HaloInput } from '../../components/ui/halo-input';
import { HaloField, HaloFieldLabel } from '../../components/ui/halo-field';
import { HaloSegmented } from '../../components/ui/halo-segmented';
import { BorderBeamButton } from '../../components/ui/border-beam-button';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitation') || searchParams.get('token') || '';

  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [accountType, setAccountType] = useState('brand');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isPublicRegistrationAllowed, setIsPublicRegistrationAllowed] = useState<boolean | null>(
    null,
  );
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadConfig() {
      try {
        const config = await api.getPublicAuthConfig();
        if (mounted) {
          setIsPublicRegistrationAllowed(config.allowPublicRegistrations);
        }
      } catch {
        if (mounted) {
          setIsPublicRegistrationAllowed(true);
        }
      } finally {
        if (mounted) {
          setIsCheckingConfig(false);
        }
      }
    }
    void loadConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await register(
        name.trim(),
        email.trim(),
        password,
        workspaceName.trim() || undefined,
        invitationToken || undefined,
      );
      router.push('/');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed. This email may already be in use.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while checking platform registration configuration
  if (isCheckingConfig) {
    return (
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-[2rem] p-8 shadow-xl flex flex-col items-center justify-center space-y-4 min-h-[350px]">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-[#FF4F17] rounded-full animate-spin" />
        <p className="text-xs text-[#6E6E73] animate-pulse">Checking registration availability...</p>
      </div>
    );
  }

  // Restricted Access State: Public registrations disabled and no invitation token provided
  if (isPublicRegistrationAllowed === false && !invitationToken) {
    return (
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-[2rem] p-6 sm:p-9 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            Registration Restricted
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] font-display">
            Public Registration is Disabled
          </h1>
          <p className="text-xs text-[#6E6E73] leading-relaxed">
            New user self-service signups have been temporarily restricted by the platform administrator.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-[#F5F5F7] p-4 text-left text-xs space-y-2">
          <div className="font-semibold text-[#1D1D1F] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FF4F17]" />
            Have an Invitation?
          </div>
          <p className="text-[#6E6E73] text-[11px] leading-relaxed">
            If your organization invited you to join NexusFlow, please open the invitation link delivered to your work email to register and join the team.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <Link
            href="/login"
            className="w-full rounded-full bg-[#1D1D1F] text-white hover:bg-black font-semibold py-2.5 text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Sign In to Existing Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/"
            className="w-full rounded-full border border-slate-200/90 bg-white text-[#1D1D1F] hover:bg-slate-50 text-xs font-semibold py-2.5 transition-all flex items-center justify-center cursor-pointer shadow-xs"
          >
            Return to Homepage
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[#86868B] border-t border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Enterprise-grade security &amp; governance</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-[2rem] p-6 sm:p-9 shadow-[0_4px_30px_rgba(0,0,0,0.04)] space-y-6">
      {invitationToken && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs flex items-center gap-2 font-medium">
          <Ticket className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Registering via verified team invitation token</span>
        </div>
      )}

      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white mb-2 shadow-xs">
          
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] font-display">
          Create Account
        </h1>
        <p className="text-xs text-[#6E6E73] leading-relaxed">
          Join NexusFlow to automate your multi-channel commerce campaigns.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-rose-700 text-xs leading-relaxed animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Account Type Selector using Cult UI HaloSegmented */}
      <div className="space-y-1.5 text-left">
        <label className="text-xs font-semibold text-[#1D1D1F]">Workspace Type</label>
        <HaloSegmented
          value={accountType}
          onValueChange={setAccountType}
          items={[
            { value: 'brand', label: 'E-commerce Brand' },
            { value: 'agency', label: 'Agency / Multi-Store' },
          ]}
        />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* Full Name with Cult UI HaloField + HaloInput */}
        <HaloField>
          <HaloFieldLabel htmlFor="register-name">Full Name</HaloFieldLabel>
          <HaloInput
            id="register-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sarah Jenkins"
            required
            disabled={isSubmitting}
            leadingSlot={<UserIcon className="w-4 h-4 text-[#86868B]" />}
          />
        </HaloField>

        {/* Work Email with Cult UI HaloField + HaloInput */}
        <HaloField>
          <HaloFieldLabel htmlFor="register-email">Work Email</HaloFieldLabel>
          <HaloInput
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sarah@flagshipstore.com"
            required
            disabled={isSubmitting}
            leadingSlot={<Mail className="w-4 h-4 text-[#86868B]" />}
          />
        </HaloField>

        {/* Store / Workspace Name with Cult UI HaloField + HaloInput */}
        <HaloField>
          <HaloFieldLabel htmlFor="register-workspace">Store / Workspace Name</HaloFieldLabel>
          <HaloInput
            id="register-workspace"
            type="text"
            name="workspaceName"
            autoComplete="organization"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. Flagship Fashion Co. (Optional)"
            disabled={isSubmitting}
            leadingSlot={<Building2 className="w-4 h-4 text-[#86868B]" />}
          />
        </HaloField>

        {/* Password with Cult UI HaloField + HaloInput */}
        <HaloField>
          <HaloFieldLabel htmlFor="register-password">
            Password (min 8 characters)
          </HaloFieldLabel>
          <HaloInput
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            minLength={8}
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

        {/* Submit with Cult UI BorderBeamButton */}
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
                <span>Create Free Workspace</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </BorderBeamButton>
        </div>
      </form>

      <div className="pt-1 text-center text-xs text-[#6E6E73]">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[#FF4F17] hover:underline">
          Sign In
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[#86868B] border-t border-slate-100">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>Enterprise-grade workspace isolation &amp; data privacy</span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-[750px] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F5F7]">
      <Suspense
        fallback={
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#FF4F17] rounded-full animate-spin" />
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
