'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { api, type PostItem, type PublishAttemptItem, type PostStatusType } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  Eye,
  ShieldCheck,
  Ban,
  Tag,
  Share2,
} from 'lucide-react';

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All Posts', value: '' },
  { label: 'Drafts', value: 'DRAFT' },
  { label: 'Awaiting Approval', value: 'AWAITING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

export default function PostsPage() {
  const { currentWorkspace, token } = useAuth();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Modals state
  const [approvalPost, setApprovalPost] = useState<PostItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState<string>('');

  const [schedulePostItem, setSchedulePostItem] = useState<PostItem | null>(null);
  const [scheduleDateTime, setScheduleDateTime] = useState<string>('');

  const [inspectPost, setInspectPost] = useState<PostItem | null>(null);
  const [attempts, setAttempts] = useState<PublishAttemptItem[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState<boolean>(false);

  const loadPosts = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    setIsLoading(true);
    try {
      const res = await api.getPosts(currentWorkspace.id, {
        status: (selectedStatus as PostStatusType) || undefined,
        limit: 50,
      });
      setPosts(res.items);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load posts',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, token, selectedStatus]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const handleRequestApproval = async (postId: string) => {
    if (!currentWorkspace?.id) return;
    setActionInProgress(postId);
    try {
      await api.requestPostApproval(currentWorkspace.id, postId);
      setStatusMessage({ type: 'success', text: 'Approval requested successfully.' });
      await loadPosts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to request approval.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleApproveDecision = async (approve: boolean) => {
    if (!currentWorkspace?.id || !approvalPost) return;
    setActionInProgress(approvalPost.id);
    try {
      if (approve) {
        await api.approvePost(currentWorkspace.id, approvalPost.id, decisionNotes);
        setStatusMessage({ type: 'success', text: 'Post approved successfully.' });
      } else {
        await api.rejectPost(currentWorkspace.id, approvalPost.id, decisionNotes);
        setStatusMessage({ type: 'success', text: 'Post rejected back to draft.' });
      }
      setApprovalPost(null);
      setDecisionNotes('');
      await loadPosts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Decision action failed.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleScheduleConfirm = async () => {
    if (!currentWorkspace?.id || !schedulePostItem || !scheduleDateTime) return;
    setActionInProgress(schedulePostItem.id);
    try {
      await api.schedulePost(
        currentWorkspace.id,
        schedulePostItem.id,
        new Date(scheduleDateTime).toISOString(),
      );
      setStatusMessage({ type: 'success', text: 'Post scheduled successfully!' });
      setSchedulePostItem(null);
      setScheduleDateTime('');
      await loadPosts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to schedule post.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePublishNow = async (postId: string) => {
    if (!currentWorkspace?.id) return;
    if (!confirm('Publish this post immediately to the connected channel?')) return;
    setActionInProgress(postId);
    try {
      const res = await api.publishPostNow(currentWorkspace.id, postId);
      setStatusMessage({
        type: 'success',
        text: `Post published successfully! Provider ID: ${res.post.providerPostId || 'Verified'}`,
      });
      await loadPosts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Publishing failed.',
      });
      await loadPosts();
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancelPost = async (postId: string) => {
    if (!currentWorkspace?.id) return;
    setActionInProgress(postId);
    try {
      await api.cancelPost(currentWorkspace.id, postId);
      setStatusMessage({ type: 'success', text: 'Post cancelled.' });
      await loadPosts();
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to cancel post.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleInspectAttempts = async (post: PostItem) => {
    if (!currentWorkspace?.id) return;
    setInspectPost(post);
    setLoadingAttempts(true);
    try {
      const list = await api.getPostAttempts(currentWorkspace.id, post.id);
      setAttempts(list);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load attempt logs');
    } finally {
      setLoadingAttempts(false);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.content.toLowerCase().includes(q) ||
      (p.product?.title && p.product.title.toLowerCase().includes(q)) ||
      (p.socialAccount?.displayName && p.socialAccount.displayName.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: PostStatusType) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F2F4F7] text-[#344054]">
            Draft
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFFAEB] text-[#B54708] border border-[#FEDF89]">
            Awaiting Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF]">
            Approved
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F9F5FF] text-[#6941C6] border border-[#E9D7FE]">
            Scheduled
          </span>
        );
      case 'PUBLISHING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF6EE] text-[#B93815] animate-pulse">
            Publishing...
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Published
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
            <AlertCircle className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F2F4F7] text-[#667085]">
            Cancelled
          </span>
        );
    }
  };

  return (
    <ProtectedRoute
      fallbackTitle="Posts & Pipeline Access"
      fallbackDescription="Sign in to your workspace to view, approve, and manage multi-channel social posts."
    >
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E4E7EC] mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#17202A]">Posts & Pipeline</h1>
            <p className="text-xs text-[#667085] mt-1">
              Manage drafts, review approval requests, schedule publishing dates, and inspect
              provider delivery attempts.
            </p>
          </div>

          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <button
              type="button"
              onClick={() => void loadPosts()}
              disabled={isLoading}
              className="p-2 border border-[#D0D5DD] rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all"
              title="Refresh Posts"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <Link
              href="/composer"
              className="inline-flex items-center px-4 py-2 bg-[#E85D2A] text-white text-xs font-semibold rounded-lg hover:bg-[#D44D1E] shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Post in Composer
            </Link>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex items-center justify-between border ${
              statusMessage.type === 'success'
                ? 'bg-[#16803C]/10 border-[#16803C]/20 text-[#16803C]'
                : 'bg-[#B42318]/10 border-[#B42318]/20 text-[#B42318]'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 border-b border-[#F2F4F7]">
            {STATUS_FILTERS.map((f) => {
              const isActive = selectedStatus === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setSelectedStatus(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#17202A] text-white'
                      : 'text-[#667085] hover:bg-[#F2F4F7] hover:text-[#17202A]'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#98A2B3]" />
            <input
              type="text"
              placeholder="Search content, linked products, or channel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#D0D5DD] rounded-lg text-xs outline-none focus:border-[#E85D2A] focus:ring-1 focus:ring-[#E85D2A]"
            />
          </div>
        </div>

        {/* Posts List / Table */}
        <div className="bg-white border border-[#E4E7EC] rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-[#667085]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#E85D2A]" />
              Loading your posts...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Send className="w-10 h-10 mx-auto text-[#D0D5DD]" />
              <h3 className="text-sm font-bold text-[#17202A]">No posts found</h3>
              <p className="text-xs text-[#667085] max-w-sm mx-auto">
                {selectedStatus
                  ? `No posts currently matching "${selectedStatus}" filter.`
                  : 'Your post pipeline is empty. Compose high-converting marketing drafts to start.'}
              </p>
              <Link
                href="/composer"
                className="inline-flex items-center px-4 py-2 bg-[#E85D2A] text-white text-xs font-semibold rounded-lg hover:bg-[#D44D1E] shadow-sm transition-all mt-2"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Open Composer
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F2F4F7]">
              {filteredPosts.map((post) => {
                const isWorking = actionInProgress === post.id;
                return (
                  <div
                    key={post.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FAFAFA] transition-all"
                  >
                    {/* Left Column: Post Details */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(post.status)}

                        {post.socialAccount && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F2F4F7] text-[#344054]">
                            <Share2 className="w-2.5 h-2.5 mr-1" />
                            {post.socialAccount.displayName} ({post.socialAccount.provider})
                          </span>
                        )}

                        {post.product && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F7F8FA] text-[#475467] border border-[#E4E7EC]">
                            <Tag className="w-2.5 h-2.5 mr-1" />
                            {post.product.title}
                          </span>
                        )}

                        {post.scheduledAt && (
                          <span className="inline-flex items-center text-[11px] text-[#6941C6] font-medium">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(post.scheduledAt).toLocaleString()}
                          </span>
                        )}

                        {post.publishedAt && (
                          <span className="inline-flex items-center text-[11px] text-[#027A48] font-medium">
                            <Clock className="w-3 h-3 mr-1" />
                            Published {new Date(post.publishedAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#17202A] line-clamp-2 whitespace-pre-line font-normal leading-relaxed">
                        {post.content}
                      </p>

                      {post.latestApproval && (
                        <p className="text-[11px] text-[#667085] italic">
                          Review note: &quot;{post.latestApproval.decisionNotes || 'Approved'}&quot;
                        </p>
                      )}
                    </div>

                    {/* Right Column: Actions */}
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                      {/* Draft Actions */}
                      {post.status === 'DRAFT' && (
                        <>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handleRequestApproval(post.id)}
                            className="px-3 py-1.5 border border-[#0A66C2] text-[#0A66C2] rounded-lg text-xs font-semibold hover:bg-[#0A66C2]/10 transition-all"
                          >
                            Request Approval
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handlePublishNow(post.id)}
                            className="px-3 py-1.5 bg-[#E85D2A] text-white rounded-lg text-xs font-semibold hover:bg-[#D44D1E] transition-all"
                          >
                            Publish Now
                          </button>
                        </>
                      )}

                      {/* Awaiting Approval Actions */}
                      {post.status === 'AWAITING_APPROVAL' && (
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => setApprovalPost(post)}
                          className="px-3 py-1.5 bg-[#175CD3] text-white rounded-lg text-xs font-semibold hover:bg-[#154fc4] transition-all flex items-center"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Review Post
                        </button>
                      )}

                      {/* Approved Actions */}
                      {post.status === 'APPROVED' && (
                        <>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => setSchedulePostItem(post)}
                            className="px-3 py-1.5 border border-[#6941C6] text-[#6941C6] rounded-lg text-xs font-semibold hover:bg-[#6941C6]/10 transition-all flex items-center"
                          >
                            <Calendar className="w-3.5 h-3.5 mr-1" />
                            Schedule
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handlePublishNow(post.id)}
                            className="px-3 py-1.5 bg-[#E85D2A] text-white rounded-lg text-xs font-semibold hover:bg-[#D44D1E] transition-all flex items-center"
                          >
                            <Send className="w-3.5 h-3.5 mr-1" />
                            Publish Now
                          </button>
                        </>
                      )}

                      {/* Scheduled Actions */}
                      {post.status === 'SCHEDULED' && (
                        <>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handlePublishNow(post.id)}
                            className="px-3 py-1.5 bg-[#E85D2A] text-white rounded-lg text-xs font-semibold hover:bg-[#D44D1E] transition-all"
                          >
                            Publish Now
                          </button>
                          <button
                            type="button"
                            disabled={isWorking}
                            onClick={() => handleCancelPost(post.id)}
                            className="px-3 py-1.5 border border-[#D0D5DD] text-[#667085] rounded-lg text-xs font-semibold hover:text-[#B42318] hover:border-[#B42318] transition-all"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1 inline" />
                            Cancel
                          </button>
                        </>
                      )}

                      {/* Failed Actions */}
                      {post.status === 'FAILED' && (
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => handlePublishNow(post.id)}
                          className="px-3 py-1.5 bg-[#B42318] text-white rounded-lg text-xs font-semibold hover:bg-[#912014] transition-all"
                        >
                          Retry Publish
                        </button>
                      )}

                      {/* Inspect Attempts Button */}
                      {(post.attemptsCount ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleInspectAttempts(post)}
                          className="px-2.5 py-1.5 border border-[#D0D5DD] text-[#344054] rounded-lg text-xs font-medium hover:bg-[#F2F4F7] transition-all flex items-center"
                          title="Inspect Publishing Attempts"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Attempts ({post.attemptsCount})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Approval Decision Modal */}
        {approvalPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 bg-white">
              {/* Header */}
              <div className="p-5 border-b border-[#F2F4F7] flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#175CD3] flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17202A]">Review Post for Approval</h3>
                    <p className="text-xs text-[#667085] mt-0.5">Approve or reject this post back to draft with optional reviewer notes.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setApprovalPost(null)}
                  className="p-1.5 rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all flex-shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div className="p-3.5 bg-[#F7F8FA] border border-[#E4E7EC] rounded-xl text-xs whitespace-pre-line text-[#17202A] leading-relaxed">
                  {approvalPost.content}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Decision Notes / Review Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Optional notes for the author..."
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#F9FAFB] border-t border-[#F2F4F7] px-6 py-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setApprovalPost(null)}
                  className="border border-[#E4E7EC] text-[#344054] rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#F9FAFB] transition-all"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleApproveDecision(false)}
                    className="border border-red-300 text-red-600 hover:bg-red-50 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
                  >
                    Reject to Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproveDecision(true)}
                    className="bg-[#12B76A] text-white hover:bg-[#0DA55F] rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
                  >
                    Approve Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scheduling Modal */}
        {schedulePostItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-w-md w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 bg-white">
              {/* Header */}
              <div className="p-5 border-b border-[#F2F4F7] flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#6941C6] flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17202A]">Schedule Post</h3>
                    <p className="text-xs text-[#667085] mt-0.5">Choose publish date and time — CommercePilot will execute automatically.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSchedulePostItem(null)}
                  className="p-1.5 rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all flex-shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1.5">
                    Select Publish Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                    className="w-full rounded-xl border border-[#E4E7EC] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30 shadow-xs"
                  />
                  <p className="text-[11px] text-[#667085] mt-1.5">
                    Scheduled in UTC. CommercePilot will publish automatically at the chosen time.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-[#F9FAFB] border-t border-[#F2F4F7] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSchedulePostItem(null)}
                  className="border border-[#E4E7EC] text-[#344054] rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#F9FAFB] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!scheduleDateTime}
                  onClick={handleScheduleConfirm}
                  className="bg-[#6941C6] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#5b32be] disabled:opacity-50 transition-all"
                >
                  Confirm Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attempt History Inspection Modal */}
        {inspectPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 bg-white">
              {/* Header */}
              <div className="p-5 border-b border-[#F2F4F7] flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#E85D2A] flex items-center justify-center flex-shrink-0">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17202A]">Publishing Attempt History</h3>
                    <p className="text-xs text-[#667085] mt-0.5">Post ID: …{inspectPost.id.slice(-6)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectPost(null)}
                  className="p-1.5 rounded-lg text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7] transition-all flex-shrink-0"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {loadingAttempts ? (
                  <div className="p-8 text-center text-xs text-[#667085]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Loading attempts...
                  </div>
                ) : attempts.length === 0 ? (
                  <p className="text-xs text-[#667085] p-6 text-center">
                    No attempt records logged for this post yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {attempts.map((att) => (
                      <div
                        key={att.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          att.status === 'SUCCESS'
                            ? 'bg-[#ECFDF3] border-[#A6F4C5] text-[#027A48]'
                            : 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>Attempt #{att.attemptNumber}</span>
                          <span>{att.status}</span>
                        </div>
                        {att.providerRequestId && (
                          <p className="text-[11px] opacity-80">
                            Provider Req ID: {att.providerRequestId}
                          </p>
                        )}
                        {att.errorCode && (
                          <p className="text-[11px] font-semibold">
                            Error: {att.errorCode} — {att.errorMessage}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] opacity-75 pt-1">
                          <span>{new Date(att.attemptedAt).toLocaleString()}</span>
                          <span>
                            Classification: {att.isTransient ? 'Transient (Retryable)' : 'Permanent'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-[#F9FAFB] border-t border-[#F2F4F7] px-6 py-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectPost(null)}
                  className="border border-[#E4E7EC] text-[#344054] rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#F9FAFB] transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
