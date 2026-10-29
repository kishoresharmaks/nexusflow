'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { useAuth } from '../../../context/auth-context';
import {
  api,
  type WorkspaceInvitation,
  type WorkspaceMember,
  type WorkspaceRole,
} from '../../../lib/api';
import { SettingsLayout } from '../../../components/settings-layout';
import {
  Crown,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  Send,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Ban,
  UserCheck,
} from 'lucide-react';

const roleLabel: Record<WorkspaceRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

type CreationMode = 'INVITE' | 'CREATE';

function TeamManagement() {
  const { currentWorkspace, refreshWorkspaces } = useAuth();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [mode, setMode] = useState<CreationMode>('INVITE');

  // Form states for Option A: Invite by Email
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceRole, 'OWNER'>>('MEMBER');

  // Form states for Option B: Create Member
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<Exclude<WorkspaceRole, 'OWNER'>>('MEMBER');
  const [createDepartment, setCreateDepartment] = useState('');

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

  const handleInviteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await api.inviteWorkspaceMember(currentWorkspace!.id, inviteEmail, inviteRole);
      setInviteEmail('');
      setInviteRole('MEMBER');
    }, 'Invitation sent! The recipient must accept it using the invited email address.');
  };

  const handleCreateMemberSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      await api.createMemberDirectly(
        currentWorkspace!.id,
        createFullName,
        createEmail,
        createRole,
        createDepartment || undefined,
      );
      setCreateFullName('');
      setCreateEmail('');
      setCreateDepartment('');
      setCreateRole('MEMBER');
    }, 'Member created and secure activation email sent! The member will be able to set their password and access this workspace.');
  };

  if (!currentWorkspace || (!isOwner && !isAdmin)) {
    return <AccessDenied />;
  }

  return (
    <SettingsLayout
      title="Team & access"
      description="Invite collaborators, provision team members, assign workspace-specific roles, and manage credentials securely."
      headerAction={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || working}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      }
    >
      <div className="space-y-6">
        {message && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Member Provisioning Card with Segmented Control */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          {/* Segmented Mode Selector */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#F2F4F7] pb-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-[#E85D2A]/10 p-2 text-[#E85D2A]">
                {mode === 'INVITE' ? <Mail className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              </span>
              <div>
                <h2 className="font-bold text-[#17202A]">
                  {mode === 'INVITE' ? 'Option A: Invite by Email' : 'Option B: Create Member Directly'}
                </h2>
                <p className="text-sm text-[#667085]">
                  {mode === 'INVITE'
                    ? 'Send a secure 7-day acceptance invitation. Ideal for existing and external users.'
                    : 'Directly provision a new account with pending activation and immediate workspace access.'}
                </p>
              </div>
            </div>

            {/* Segmented Control Buttons */}
            <div className="inline-flex rounded-xl bg-[#F2F4F7] p-1 text-xs font-semibold text-[#667085]">
              <button
                type="button"
                onClick={() => setMode('INVITE')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  mode === 'INVITE'
                    ? 'bg-white text-[#17202A] shadow-sm font-bold'
                    : 'hover:text-[#17202A]'
                }`}
              >
                Option A: Invite by Email
              </button>
              <button
                type="button"
                onClick={() => setMode('CREATE')}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  mode === 'CREATE'
                    ? 'bg-white text-[#17202A] shadow-sm font-bold'
                    : 'hover:text-[#17202A]'
                }`}
              >
                Option B: Create Member
              </button>
            </div>
          </div>

          {/* Mode A Form: Invite by Email */}
          {mode === 'INVITE' && (
            <form onSubmit={(event) => void handleInviteSubmit(event)} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <div>
                <label className="sr-only" htmlFor="invite-email">Email address</label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                />
              </div>
              <div>
                <label className="sr-only" htmlFor="invite-role">Role</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as Exclude<WorkspaceRole, 'OWNER'>)}
                  className="w-full min-h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                >
                  {allowedInviteRoles.map((item) => (
                    <option key={item} value={item}>{roleLabel[item]}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={working || !inviteEmail}
                  className="min-h-10 inline-flex items-center gap-1.5 rounded-lg bg-[#E85D2A] px-4 text-sm font-bold text-white hover:bg-[#D04E1F] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Send Invite
                </button>
                {inviteEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setInviteEmail('');
                      setInviteRole('MEMBER');
                    }}
                    className="min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Mode B Form: Create Member Directly */}
          {mode === 'CREATE' && (
            <form onSubmit={(event) => void handleCreateMemberSubmit(event)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label htmlFor="create-name" className="block text-xs font-semibold text-[#344054] mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="create-name"
                    type="text"
                    required
                    value={createFullName}
                    onChange={(e) => setCreateFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                  />
                </div>
                <div>
                  <label htmlFor="create-email" className="block text-xs font-semibold text-[#344054] mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="create-email"
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="jane@company.com"
                    className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                  />
                </div>
                <div>
                  <label htmlFor="create-role" className="block text-xs font-semibold text-[#344054] mb-1">
                    Workspace Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="create-role"
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as Exclude<WorkspaceRole, 'OWNER'>)}
                    className="w-full min-h-10 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                  >
                    {allowedInviteRoles.map((item) => (
                      <option key={item} value={item}>{roleLabel[item]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-dept" className="block text-xs font-semibold text-[#344054] mb-1">
                    Department / Team (Optional)
                  </label>
                  <input
                    id="create-dept"
                    type="text"
                    value={createDepartment}
                    onChange={(e) => setCreateDepartment(e.target.value)}
                    placeholder="Marketing, Growth..."
                    className="w-full min-h-10 rounded-lg border border-[#D0D5DD] px-3 text-sm outline-none focus:border-[#E85D2A] focus:ring-2 focus:ring-[#E85D2A]/20"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#F2F4F7]">
                <p className="text-xs text-[#667085]">
                  A single-use, 7-day activation link will be dispatched. No plaintext passwords are ever generated or stored.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateFullName('');
                      setCreateEmail('');
                      setCreateDepartment('');
                      setCreateRole('MEMBER');
                    }}
                    className="min-h-10 rounded-lg border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={working || !createFullName || !createEmail}
                    className="min-h-10 inline-flex items-center gap-1.5 rounded-lg bg-[#E85D2A] px-5 text-sm font-bold text-white hover:bg-[#D04E1F] disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" /> Create Member & Send Activation Email
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>

        {/* Members List Section */}
        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E4E7EC] p-5">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-[#175CD3]" />
              <div>
                <h2 className="font-bold text-[#17202A]">Members</h2>
                <p className="text-sm text-[#667085]">{members.length} workspace member{members.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#667085]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500"></span> Active</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Pending / Unverified</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500"></span> Suspended</span>
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-[#667085]">Loading team…</p>
          ) : (
            <div className="divide-y divide-[#EAECF0]">
              {members.map((member) => (
                <MemberRow
                  key={member.membershipId}
                  member={member}
                  actorRole={currentWorkspace.role as WorkspaceRole}
                  working={working}
                  onChangeRole={(nextRole) => void run(async () => {
                    await api.updateWorkspaceMemberRole(currentWorkspace.id, member.membershipId, nextRole);
                  }, 'Member role updated.')}
                  onToggleStatus={(nextStatus) => void run(async () => {
                    await api.updateWorkspaceMemberStatus(currentWorkspace.id, member.membershipId, nextStatus);
                  }, nextStatus === 'ACTIVE' ? 'Membership reactivated.' : 'Membership suspended.')}
                  onRemove={() => void run(async () => {
                    await api.removeWorkspaceMember(currentWorkspace.id, member.membershipId);
                  }, 'Member removed from workspace.')}
                  onTransfer={() => void run(async () => {
                    await api.startOwnershipTransfer(currentWorkspace.id, member.membershipId);
                  }, 'Ownership transfer request sent. The recipient must accept within 24 hours.')}
                />
              ))}
            </div>
          )}
        </section>

        {/* Pending Invitations Section */}
        <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-[#E85D2A]" />
            <h2 className="font-bold text-[#17202A]">Pending invitations</h2>
          </div>
          <div className="space-y-3">
            {invitations.length === 0 ? (
              <p className="text-sm text-[#667085]">No pending invitations.</p>
            ) : (
              invitations.map((invitation) => {
                const isExpired = invitation.status === 'EXPIRED' || new Date(invitation.expiresAt) <= new Date();
                return (
                  <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4E7EC] p-3.5 hover:border-[#D0D5DD] transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#17202A]">{invitation.emailNormalized}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isExpired
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-[#B54708] border border-amber-200'
                        }`}>
                          {isExpired ? 'Expired' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-[#667085]">
                        Assigned Role: <strong className="text-[#344054]">{roleLabel[invitation.role]}</strong> · Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void run(async () => {
                          await api.resendWorkspaceInvitation(currentWorkspace.id, invitation.id);
                        }, 'Invitation token refreshed and email resent.')}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" /> Resend
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => void run(async () => {
                          await api.revokeWorkspaceInvitation(currentWorkspace.id, invitation.id);
                        }, 'Invitation revoked.')}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}

function MemberRow({
  member,
  actorRole,
  working,
  onChangeRole,
  onToggleStatus,
  onRemove,
  onTransfer,
}: {
  member: WorkspaceMember;
  actorRole: WorkspaceRole;
  working: boolean;
  onChangeRole: (role: Exclude<WorkspaceRole, 'OWNER'>) => void;
  onToggleStatus: (nextStatus: 'ACTIVE' | 'SUSPENDED') => void;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  const isOwner = member.role === 'OWNER';
  const canManage = !isOwner;
  const roleOptions: Exclude<WorkspaceRole, 'OWNER'>[] =
    actorRole === 'OWNER' ? ['ADMIN', 'MEMBER', 'VIEWER'] : ['MEMBER', 'VIEWER'];

  const membershipStatus = member.status ?? 'ACTIVE';
  const accountStatus = member.user.accountStatus ?? 'ACTIVE';
  const isSuspended = membershipStatus === 'SUSPENDED';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 p-5 transition-colors ${
      isSuspended ? 'bg-red-50/30' : ''
    }`}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#17202A]">{member.user.name}</p>
          {isOwner && <Crown className="h-4 w-4 text-[#B54708]" />}

          {/* Role badge */}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isOwner
              ? 'bg-[#E85D2A]/10 text-[#B54708]'
              : member.role === 'ADMIN'
              ? 'bg-blue-50 text-[#175CD3]'
              : 'bg-gray-100 text-[#344054]'
          }`}>
            {roleLabel[member.role]}
          </span>

          {/* Membership Status Badge */}
          {membershipStatus === 'SUSPENDED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
              <Ban className="h-3 w-3" /> Membership suspended
            </span>
          )}
          {membershipStatus === 'PENDING_ACCEPTANCE' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
              <Clock className="h-3 w-3" /> Membership pending
            </span>
          )}

          {/* Account Status Badge */}
          {accountStatus === 'PENDING_ACTIVATION' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
              <Clock className="h-3 w-3" /> Account pending activation
            </span>
          )}
          {accountStatus === 'SUSPENDED' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 border border-red-200">
              <ShieldAlert className="h-3 w-3" /> Account suspended
            </span>
          )}

          {/* Email Verification Status Badge */}
          {member.user.isEmailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Email verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[#B54708]">
              <AlertCircle className="h-3 w-3" /> Email unverified
            </span>
          )}
        </div>
        <p className="truncate text-sm text-[#667085]">{member.user.email}</p>
      </div>

      {/* Permitted Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {isOwner ? (
          <span className="rounded-full bg-[#E85D2A]/10 px-2.5 py-1 text-xs font-bold text-[#B54708]">Sole Owner</span>
        ) : (
          <select
            aria-label={`Role for ${member.user.email}`}
            disabled={!canManage || working}
            value={member.role}
            onChange={(event) => onChangeRole(event.target.value as Exclude<WorkspaceRole, 'OWNER'>)}
            className="min-h-9 rounded-lg border border-[#D0D5DD] bg-white px-2.5 text-sm disabled:opacity-50 outline-none focus:border-[#E85D2A]"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{roleLabel[role]}</option>
            ))}
          </select>
        )}

        {/* Suspend / Reactivate Membership Button */}
        {canManage && (
          <button
            type="button"
            disabled={working}
            onClick={() => onToggleStatus(isSuspended ? 'ACTIVE' : 'SUSPENDED')}
            className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold disabled:opacity-50 ${
              isSuspended
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            {isSuspended ? (
              <>
                <UserCheck className="h-3.5 w-3.5" /> Reactivate access
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" /> Suspend access
              </>
            )}
          </button>
        )}

        {/* Transfer Ownership Button (Owner only) */}
        {actorRole === 'OWNER' && !isOwner && (
          <button
            type="button"
            disabled={working}
            onClick={onTransfer}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#175CD3] hover:bg-blue-50 disabled:opacity-50"
          >
            <Crown className="h-3.5 w-3.5" /> Transfer ownership
          </button>
        )}

        {/* Remove Member Button */}
        {canManage && (
          <button
            type="button"
            disabled={working}
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove ${member.user.name} from this workspace? Their global account will remain intact.`)) {
                onRemove();
              }
            }}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-[500px] max-w-xl items-center px-4 py-8">
      <div className="w-full rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-10 w-10 text-[#B54708]" />
        <h1 className="mt-4 text-2xl font-bold text-[#17202A]">Team settings are restricted</h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          Only the workspace Owner or an Admin can manage team access. Ask an Owner to update your role if you need access.
        </p>
      </div>
    </main>
  );
}

export default function TeamPage() {
  return (
    <ProtectedRoute fallbackTitle="Sign in to manage your team">
      <TeamManagement />
    </ProtectedRoute>
  );
}
