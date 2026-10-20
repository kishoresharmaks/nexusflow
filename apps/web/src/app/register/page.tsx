'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
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
} from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const { register, createWorkspace } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="w-full max-w-md bg-card border border-border/70 rounded-2xl p-8 shadow-xl space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-2 shadow-inner">
          <UserPlus className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Account</h1>
        <p className="text-xs text-muted-foreground">
          Join CommercePilot to automate your multi-channel marketing campaigns.
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
          <label className="text-xs font-semibold text-foreground">Full Name</label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sarah Jenkins"
              required
              disabled={isSubmitting}
              className="w-full rounded-xl border border-input bg-background pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-foreground">Work Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@flagshipstore.com"
              required
              disabled={isSubmitting}
              className="w-full rounded-xl border border-input bg-background pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-foreground">Store / Workspace Name</label>
          <div className="relative">
            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              name="workspaceName"
              autoComplete="organization"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Flagship Fashion Co. (Optional)"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-input bg-background pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-xs font-semibold text-foreground">
            Password (min 8 characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={8}
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
              Create Free Workspace
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign In
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-muted-foreground border-t border-border/40">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Enterprise-grade MongoDB multi-tenant isolation</span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="min-h-[750px] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        }
      >
        <RegisterForm />
      </Suspense>
    </div>
  );
}
