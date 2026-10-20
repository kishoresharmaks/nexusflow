'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';

function AcceptInvitation() {
  const params = useSearchParams();
  const { refreshWorkspaces } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = params.get('token');
  const accept = async () => {
    if (!token) return;
    setError(null);
    try { const result = await api.acceptWorkspaceInvitation(token); await refreshWorkspaces(); setStatus(`You joined the workspace as ${result.role.toLowerCase()}.`); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to accept invitation.'); }
  };
  return <main className="mx-auto max-w-xl px-4 py-16"><section className="rounded-2xl border border-[#E4E7EC] bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-[#17202A]">Join workspace</h1><p className="mt-2 text-sm text-[#667085]">Accept this invitation only if you signed in using the email address that received it.</p>{status && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">{status}</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button type="button" disabled={!token || Boolean(status)} onClick={() => void accept()} className="mt-6 rounded-lg bg-[#E85D2A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Accept invitation</button></section></main>;
}

export default function InvitationAcceptPage() { return <ProtectedRoute fallbackTitle="Sign in to accept this invitation"><Suspense fallback={<main className="p-8 text-center text-sm text-[#667085]">Loading invitation…</main>}><AcceptInvitation /></Suspense></ProtectedRoute>; }
