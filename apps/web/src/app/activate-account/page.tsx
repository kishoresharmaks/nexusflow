'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Lock, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

function ActivateAccountContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state if token expired
  const [showResend, setShowResend] = useState(!token);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Missing activation token. Please check the link in your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.activateAccount(token, password);
      // Remove sensitive token from browser history
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/activate-account');
      }
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Activation failed. The token may be expired or invalid.';
      setError(msg);
      setShowResend(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendLoading(true);
    setResendMessage(null);
    setError(null);
    try {
      const res = await api.resendActivation(resendEmail);
      setResendMessage(res.message || 'Activation email sent if account is pending activation.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to dispatch activation email.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white p-8 shadow-sm">
        {/* Brand header */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#E85D2A]/10 text-[#E85D2A] mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17202A]">Activate your account</h1>
          <p className="mt-1.5 text-sm text-[#667085]">
            Set your secure password to complete account activation and access your workspace.
          </p>
        </div>

        {/* Success View */}
        {success ? (
          <div className="mt-6 text-center space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
              <div className="flex items-center justify-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span>Account Activated Successfully!</span>
              </div>
              <p className="mt-1 text-xs text-green-700">
                Your credentials are secure and your workspace membership is active.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#E85D2A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#D04E1F]"
            >
              Sign in to NexusFlow <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {token && !showResend ? (
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-[#344054] mb-1">
                    New Password (minimum 8 characters) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#344054] mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                  />
                </div>

                <div className="rounded-lg bg-[#F9FAFB] p-3 text-xs text-[#667085] space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-[#344054]">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Security Guaranteed</span>
                  </div>
                  <p>Passwords are securely protected and never stored or transmitted in plain text.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || password.length < 8}
                  className="w-full min-h-10 rounded-lg bg-[#E85D2A] px-4 text-sm font-bold text-white hover:bg-[#D04E1F] disabled:opacity-50"
                >
                  {loading ? 'Activating account…' : 'Activate Account & Continue'}
                </button>
              </form>
            ) : (
              /* Resend Activation Section */
              <div className="space-y-4 pt-2">
                <div className="rounded-lg bg-amber-50 p-3.5 border border-amber-200 text-xs text-amber-900">
                  <p className="font-semibold mb-1">Activation link missing or expired?</p>
                  <p>Enter your email address below to receive a fresh activation link.</p>
                </div>

                {resendMessage && (
                  <div className="rounded-lg bg-green-50 p-3 border border-green-200 text-xs text-green-800">
                    {resendMessage}
                  </div>
                )}

                <form onSubmit={(e) => void handleResend(e)} className="space-y-3">
                  <div>
                    <label htmlFor="resend-email" className="block text-xs font-semibold text-[#344054] mb-1">
                      Email address
                    </label>
                    <input
                      id="resend-email"
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
                    disabled={resendLoading || !resendEmail}
                    className="w-full min-h-10 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#E85D2A] px-4 text-sm font-bold text-white hover:bg-[#D04E1F] disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" /> {resendLoading ? 'Sending…' : 'Send Replacement Link'}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <Link href="/login" className="text-xs text-[#E85D2A] font-semibold hover:underline">
                    Back to Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading activation portal…</div>}>
      <ActivateAccountContent />
    </Suspense>
  );
}
