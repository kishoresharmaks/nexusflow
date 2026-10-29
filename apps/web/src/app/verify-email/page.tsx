'use client';

import { Suspense, useEffect, useState, FormEvent, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../context/auth-context';
import { CheckCircle2, AlertCircle, Mail, ArrowRight, ShieldCheck, RefreshCw, Send } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user, refreshUser } = useAuth();

  const [verifying, setVerifying] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend form state
  const [resendEmail, setResendEmail] = useState(user?.email || '');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const performVerification = useCallback(async (verifyToken: string) => {
    setVerifying(true);
    setError(null);
    try {
      await api.verifyEmail(verifyToken);
      // Clean query token from browser history
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/verify-email');
      }
      setSuccess(true);
      await refreshUser();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Verification link is invalid or expired. You can request a replacement below.',
      );
    } finally {
      setVerifying(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    if (token) {
      void performVerification(token);
    }
  }, [token, performVerification]);

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    setResending(true);
    setResendSuccess(null);
    setError(null);
    try {
      const res = await api.resendVerification(resendEmail || undefined);
      setResendSuccess(res.message || 'Verification link sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#E85D2A]/10 text-[#E85D2A] mb-3">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17202A]">Email Verification</h1>
          <p className="mt-1 text-sm text-[#667085]">
            Confirm your email address to establish ownership and enable full workspace features.
          </p>
        </div>

        {verifying && (
          <div className="mt-6 flex flex-col items-center justify-center p-6 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#E85D2A]" />
            <p className="text-sm font-semibold text-[#344054]">Verifying your email address…</p>
          </div>
        )}

        {!verifying && success && (
          <div className="mt-6 text-center space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
              <div className="flex items-center justify-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Email Address Verified!</span>
              </div>
              <p className="mt-1 text-xs text-green-700">
                Your email has been confirmed. All workspace privileges and identity verification are now active.
              </p>
            </div>

            <Link
              href="/settings/team"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E85D2A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#D04E1F]"
            >
              Continue to Team & Access <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!verifying && !success && (
          <div className="mt-6 space-y-4">
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {resendSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3.5 text-xs text-green-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <span>{resendSuccess}</span>
              </div>
            )}

            <div className="rounded-xl bg-[#F9FAFB] border border-[#EAECF0] p-4 text-xs text-[#667085] space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-[#17202A]">
                <ShieldCheck className="h-4 w-4 text-[#E85D2A]" />
                <span>Need a new verification link?</span>
              </div>
              <p>
                Verification tokens expire in 24 hours. Request a new link below to verify your email address.
              </p>
            </div>

            <form onSubmit={(e) => void handleResend(e)} className="space-y-3">
              <div>
                <label htmlFor="verify-email-input" className="block text-xs font-semibold text-[#344054] mb-1">
                  Account email address
                </label>
                <input
                  id="verify-email-input"
                  type="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                />
              </div>

              <button
                type="submit"
                disabled={resending || !resendEmail}
                className="w-full min-h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#E85D2A] px-4 text-sm font-bold text-white hover:bg-[#D04E1F] disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {resending ? 'Sending verification link…' : 'Send Verification Email'}
              </button>
            </form>

            <div className="text-center pt-2">
              <Link href="/settings/team" className="text-xs text-[#E85D2A] font-semibold hover:underline">
                Back to Workspace Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Checking email verification…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
