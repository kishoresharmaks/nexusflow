'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';

function AcceptTransfer() {
  const params = useSearchParams();
  const { refreshWorkspaces } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const transferId = params.get('transferId');
  const accept = async () => {
    if (!transferId) return;
    setError(null);
    try { await api.acceptOwnershipTransfer(transferId); await refreshWorkspaces(); setMessage('Ownership transferred successfully. You are now the workspace owner.'); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to accept ownership transfer.'); }
  };
  return <main className="mx-auto max-w-xl px-4 py-16"><section className="rounded-2xl border border-[#E4E7EC] bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-[#17202A]">Accept workspace ownership</h1><p className="mt-2 text-sm text-[#667085]">Accept only if you understand that you will become responsible for this workspace.</p>{message && <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}{error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button type="button" disabled={!transferId || Boolean(message)} onClick={() => void accept()} className="mt-6 rounded-lg bg-[#B42318] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Accept ownership</button></section></main>;
}

export default function OwnershipTransferAcceptPage() { return <ProtectedRoute fallbackTitle="Sign in to accept this ownership transfer"><Suspense fallback={<main className="p-8 text-center text-sm text-[#667085]">Loading transfer…</main>}><AcceptTransfer /></Suspense></ProtectedRoute>; }
