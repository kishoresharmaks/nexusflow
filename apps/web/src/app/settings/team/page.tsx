'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import { api, type WorkspaceInvitation, type WorkspaceMember, type WorkspaceRole } from '../../../lib/api';
import { AlertTriangle, Crown, Mail, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';

const roleLabel: Record<WorkspaceRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

function TeamManagement() {
  const { currentWorkspace, refreshWorkspaces } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'OWNER'>>('MEMBER');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentWorkspace?.role === 'OWNER';
  const isAdmin = currentWorkspace?.role === 'ADMIN';
  const allowedInviteRoles: Exclude<WorkspaceRole, 'OWNER'>[] = isOwner
    ? ['ADMIN', 'MEMBER', 'VIEWER']
    : ['MEMBER', 'VIEWER'];

  const load = useCallback(async () => {
    if (!currentWorkspace || (!isOwner && !isAdmin)) return;
    setLoading(true);
    setError(null);
    try {
      const [memberItems, invitationItems] = await Promise.all([
        api.getWorkspaceMembers(currentWorkspace.id),
        api.getWorkspaceInvitations(currentWorkspace.id),
      ]);
      setMembers(memberItems);
      setInvitations(invitationItems.filter((item) => !item.acceptedAt && !item.revokedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the team.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace, isAdmin, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>, success: string) => {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
      await refreshWorkspaces();
      setMessage(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The action could not be completed.');
    } finally {
      setWorking(false);
    }
  };

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await api.inviteWorkspaceMember(currentWorkspace!.id, email, role);
      setEmail('');
      setRole(isOwner ? 'MEMBER' : 'MEMBER');
    }, 'Invitation created. The recipient must accept it using the invited email address.');
  };

  if (!currentWorkspace || (!isOwner && !isAdmin)) {
    return <AccessDenied />;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#E85D2A]">Workspace settings</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#17202A]">Team & access</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Invite collaborators, set the minimum access they need, and keep ownership protected.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || working} className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-[#E85D2A]/10 p-2 text-[#E85D2A]"><Mail className="h-5 w-5" /></span><div><h2 className="font-bold text-[#17202A]">Invite a teammate</h2><p className="text-sm text-[#667085]">They receive a seven-day, single-use invitation. Ownership cannot be granted here.</p></div></div>
        <form onSubmit={(event) => void invite(event)} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <label className="sr-only" htmlFor="invite-email">Email address</label>
          <input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20" />
          <label className="sr-only" htmlFor="invite-role">Role</label>
          <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as Exclude<WorkspaceRole, 'OWNER'>)} className="min-h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20">
            {allowedInviteRoles.map((item) => <option key={item} value={item}>{roleLabel[item]}</option>)}
          </select>
          <button type="submit" disabled={working} className="min-h-10 rounded-lg bg-[#E85D2A] px-4 text-sm font-bold text-white hover:bg-[#D04E1F] disabled:opacity-50">Send invite</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#E4E7EC] p-5"><Users className="h-5 w-5 text-[#175CD3]" /><div><h2 className="font-bold text-[#17202A]">Members</h2><p className="text-sm text-[#667085]">{members.length} current workspace member{members.length === 1 ? '' : 's'}</p></div></div>
        {loading ? <p className="p-6 text-sm text-[#667085]">Loading team…</p> : <div className="divide-y divide-[#EAECF0]">{members.map((member) => <MemberRow key={member.membershipId} member={member} actorRole={currentWorkspace.role as WorkspaceRole} working={working} onChangeRole={(nextRole) => void run(async () => { await api.updateWorkspaceMemberRole(currentWorkspace.id, member.membershipId, nextRole); }, 'Role updated.')} onRemove={() => void run(async () => { await api.removeWorkspaceMember(currentWorkspace.id, member.membershipId); }, 'Member removed.')} onTransfer={() => void run(async () => { await api.startOwnershipTransfer(currentWorkspace.id, member.membershipId); }, 'Ownership transfer request sent. The recipient must accept within 24 hours.')} />)}</div>}
      </section>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#17202A]">Pending invitations</h2>
        <div className="mt-4 space-y-3">{invitations.length === 0 ? <p className="text-sm text-[#667085]">No pending invitations.</p> : invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E7EC] p-3"><div><p className="text-sm font-semibold text-[#17202A]">{invitation.emailNormalized}</p><p className="text-xs text-[#667085]">{roleLabel[invitation.role]} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><button type="button" disabled={working} onClick={() => void run(async () => { await api.revokeWorkspaceInvitation(currentWorkspace.id, invitation.id); }, 'Invitation revoked.')} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Revoke</button></div>)}</div>
      </section>
    </main>
  );
}

function MemberRow({ member, actorRole, working, onChangeRole, onRemove, onTransfer }: { member: WorkspaceMember; actorRole: WorkspaceRole; working: boolean; onChangeRole: (role: Exclude<WorkspaceRole, 'OWNER'>) => void; onRemove: () => void; onTransfer: () => void }) {
  const isOwner = member.role === 'OWNER';
  const canManage = !isOwner;
  const roleOptions: Exclude<WorkspaceRole, 'OWNER'>[] = actorRole === 'OWNER' ? ['ADMIN', 'MEMBER', 'VIEWER'] : ['MEMBER', 'VIEWER'];
  return <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-[#17202A]">{member.user.name}</p>{isOwner && <Crown className="h-4 w-4 text-[#B54708]" />}{!member.user.isEmailVerified && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[#B54708]">Email unverified</span>}</div><p className="truncate text-sm text-[#667085]">{member.user.email}</p></div><div className="flex flex-wrap items-center gap-2">{isOwner ? <span className="rounded-full bg-[#E85D2A]/10 px-2.5 py-1 text-xs font-bold text-[#B54708]">Owner</span> : <select aria-label={`Role for ${member.user.email}`} disabled={!canManage || working} value={member.role} onChange={(event) => onChangeRole(event.target.value as Exclude<WorkspaceRole, 'OWNER'>)} className="min-h-9 rounded-lg border border-[#D0D5DD] bg-white px-2 text-sm disabled:opacity-50">{roleOptions.map((role) => <option key={role} value={role}>{roleLabel[role]}</option>)}</select>}{actorRole === 'OWNER' && !isOwner && <button type="button" disabled={working} onClick={onTransfer} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#175CD3] hover:bg-blue-50 disabled:opacity-50"><Crown className="h-3.5 w-3.5" /> Transfer ownership</button>}{canManage && <button type="button" disabled={working} onClick={onRemove} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button>}</div></div>;
}

function AccessDenied() {
  return <main className="mx-auto flex min-h-[500px] max-w-xl items-center px-4 py-8"><div className="w-full rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-10 w-10 text-[#B54708]" /><h1 className="mt-4 text-2xl font-bold text-[#17202A]">Team settings are restricted</h1><p className="mt-2 text-sm leading-6 text-[#667085]">Only the workspace Owner or an Admin can manage team access. Ask an Owner to update your role if you need access.</p></div></main>;
}

export default function TeamPage() {
  return <ProtectedRoute fallbackTitle="Sign in to manage your team"><TeamManagement /></ProtectedRoute>;
}
