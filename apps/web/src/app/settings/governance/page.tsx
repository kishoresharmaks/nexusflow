'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedRoute } from '../../../components/protected-route';
import { SettingsLayout } from '../../../components/settings-layout';
import { useAuth } from '../../../context/auth-context';
import { api, type ApprovalPolicy, type WorkspaceRole } from '../../../lib/api';
import { ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Save, Lock, FileText } from 'lucide-react';

function GovernanceContent() {
  const { currentWorkspace } = useAuth();
  const [, setPolicy] = useState<ApprovalPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [requiresApprovalBeforeSchedule, setRequiresApprovalBeforeSchedule] = useState(false);
  const [requiresApprovalBeforePublish, setRequiresApprovalBeforePublish] = useState(true);
  const [allowedApproverRoles, setAllowedApproverRoles] = useState<WorkspaceRole[]>(['OWNER', 'ADMIN']);

  const loadPolicy = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getApprovalPolicy(currentWorkspace.id);
      setPolicy(data);
      setRequiresApprovalBeforeSchedule(data.requiresApprovalBeforeSchedule);
      setRequiresApprovalBeforePublish(data.requiresApprovalBeforePublish);
      setAllowedApproverRoles(data.allowedApproverRoles ?? ['OWNER', 'ADMIN']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load approval policy.');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const handleToggleRole = (role: WorkspaceRole) => {
    if (allowedApproverRoles.includes(role)) {
      if (allowedApproverRoles.length === 1) {
        setError('At least one approver role must remain selected.');
        return;
      }
      setAllowedApproverRoles(allowedApproverRoles.filter((r) => r !== role));
    } else {
      setAllowedApproverRoles([...allowedApproverRoles, role]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateApprovalPolicy(currentWorkspace.id, {
        requiresApprovalBeforeSchedule,
        requiresApprovalBeforePublish,
        allowedApproverRoles,
      });
      setPolicy(updated);
      setMessage('Content governance policies updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save approval policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout
      title="Content governance"
      description="Configure editorial workflow guardrails, approval gates, and publishing permissions for your workspace."
      headerAction={
        <button
          type="button"
          onClick={() => void loadPolicy()}
          disabled={loading || saving}
          className="inline-flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB] disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      }
    >
      <div className="space-y-6">
        {message && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-8 text-center text-sm text-[#667085]">
            Loading governance policies…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Approval Gates */}
            <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-lg bg-[#E85D2A]/10 p-2 text-[#E85D2A]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#17202A]">Approval gates</h2>
                  <p className="text-sm text-[#667085]">
                    Require human sign-off before content can transition across pipeline stages.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#EAECF0]">
                <label className="flex items-start justify-between py-4 cursor-pointer">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-[#17202A]">Require approval before scheduling</span>
                    <p className="text-xs text-[#667085] mt-1">
                      Posts created by team members cannot be placed on the publishing calendar until approved by an authorized role.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requiresApprovalBeforeSchedule}
                    onChange={(e) => setRequiresApprovalBeforeSchedule(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#E85D2A] focus:ring-[#E85D2A] mt-1"
                  />
                </label>

                <label className="flex items-start justify-between py-4 cursor-pointer">
                  <div className="pr-4">
                    <span className="text-sm font-semibold text-[#17202A]">Require approval before direct publishing</span>
                    <p className="text-xs text-[#667085] mt-1">
                      Posts cannot be published immediately to live social channels without an explicit approval step.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requiresApprovalBeforePublish}
                    onChange={(e) => setRequiresApprovalBeforePublish(e.target.checked)}
                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#E85D2A] focus:ring-[#E85D2A] mt-1"
                  />
                </label>
              </div>
            </section>

            {/* Approver Roles */}
            <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <span className="rounded-lg bg-[#175CD3]/10 p-2 text-[#175CD3]">
                  <Lock className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#17202A]">Eligible approver roles</h2>
                  <p className="text-sm text-[#667085]">
                    Select which workspace roles are authorized to approve drafts for scheduling and publishing.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] p-3.5 cursor-pointer hover:bg-[#F9FAFB]">
                  <input
                    type="checkbox"
                    checked={allowedApproverRoles.includes('OWNER')}
                    onChange={() => handleToggleRole('OWNER')}
                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#E85D2A] focus:ring-[#E85D2A]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[#17202A]">Workspace Owner</span>
                    <p className="text-xs text-[#667085]">Full administrative and approval authority over all posts.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] p-3.5 cursor-pointer hover:bg-[#F9FAFB]">
                  <input
                    type="checkbox"
                    checked={allowedApproverRoles.includes('ADMIN')}
                    onChange={() => handleToggleRole('ADMIN')}
                    className="h-4 w-4 rounded border-[#D0D5DD] text-[#E85D2A] focus:ring-[#E85D2A]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[#17202A]">Workspace Admin</span>
                    <p className="text-xs text-[#667085]">Can approve, edit, and publish posts on behalf of team members.</p>
                  </div>
                </label>
              </div>
            </section>

            {/* AI Grounding Guardrails */}
            <section className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#17202A]">Active AI grounding guardrails</h2>
                  <p className="text-sm text-[#667085]">
                    Built-in safeguards automatically enforced across all AI content generation.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Catalog Grounding</span>
                  <p className="mt-1 text-sm font-semibold text-[#17202A]">Factual consistency verification</p>
                  <p className="mt-1 text-xs text-[#667085]">
                    AI output is strictly grounded in synchronized store product titles, descriptions, and verified pricing.
                  </p>
                </div>
                <div className="rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Anti-Hallucination</span>
                  <p className="mt-1 text-sm font-semibold text-[#17202A]">Price & stock validation</p>
                  <p className="mt-1 text-xs text-[#667085]">
                    Posts referencing out-of-stock items or modified prices trigger automatic warnings prior to publishing.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#E85D2A] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#D04E1F] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving changes…' : 'Save governance policy'}
              </button>
            </div>
          </form>
        )}
      </div>
    </SettingsLayout>
  );
}

export default function GovernancePage() {
  return (
    <ProtectedRoute fallbackTitle="Sign in to configure governance">
      <GovernanceContent />
    </ProtectedRoute>
  );
}
