'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import { ShieldAlert, Lock, ArrowRight, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 1. Authenticate credentials
      await login(email, password);

      // 2. Validate Platform Administrator status
      try {
        await api.getSuperAdminProfile();
        router.push('/super-admin');
      } catch {
        setError(
          'Authentication succeeded, but this account is not registered as an active Platform Administrator. Workspace owners and members cannot access this console.',
        );
      }
    } catch (err) {
      setError((err as Error).message || 'Invalid credentials or authentication failure.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 antialiased selection:bg-indigo-500/20 selection:text-indigo-900 overflow-hidden">
      {/* Waymark Ambient Radial Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[350px] h-[350px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4 border border-indigo-400/30">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            NexusFlow
          </h1>
          <div className="inline-block mt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Super Admin Gateway
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto">
            Privileged platform administration console. All actions, logins, and queries are cryptographically logged.
          </p>
        </div>

        {/* Security Warning Box */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Admin Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@commercepilot.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{isLoading ? 'Verifying Privileges...' : 'Authenticate Privileged Session'}</span>
              {!isLoading && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Customer Login</span>
            </Link>

            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
              <KeyRound className="h-3 w-3 text-indigo-600" />
              <span>Audit-Enforced</span>
            </span>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-[11px] text-center text-slate-400 mt-6 font-mono">
          Privileged Operator Gateway • Secure Session Encryption
        </p>
      </div>
    </div>
  );
}
