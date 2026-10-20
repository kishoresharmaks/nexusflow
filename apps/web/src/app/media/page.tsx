'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { api, type MediaAssetItem } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  FileCheck,
  FolderLock,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';

export default function MediaLibraryPage() {
  const { currentWorkspace, token } = useAuth();

  const [mediaList, setMediaList] = useState<MediaAssetItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    setIsLoading(true);
    try {
      const items = await api.getMediaAssets(currentWorkspace.id);
      setMediaList(items);
    } catch {
      // Handled silently
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, token]);

  useEffect(() => {
    if (currentWorkspace?.id && token) {
      void fetchMedia();
    }
  }, [fetchMedia, currentWorkspace?.id, token]);

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleCopyUrl = (item: MediaAssetItem) => {
    const fullUrl = api.resolveMediaUrl(item.url || '');
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media asset?')) return;
    if (currentWorkspace?.id) {
      try {
        await api.deleteMediaAsset(currentWorkspace.id, id);
        setMediaList((prev) => prev.filter((m) => m.id !== id));
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to delete media asset');
      }
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME type
    const validMimes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4'];
    if (!validMimes.includes(file.type)) {
      setUploadError('Invalid file format. Allowed formats: PNG, JPEG, WEBP, GIF, MP4.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds maximum size limit of 25MB.');
      return;
    }

    if (!currentWorkspace?.id) {
      setUploadError('Please select or create an active workspace first.');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    try {
      const asset = await api.uploadLocalMediaAsset(currentWorkspace.id, file);
      setMediaList((prev) => [asset, ...prev]);
      setUploadSuccess(`Successfully uploaded "${file.name}".`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset input element value so user can upload same file if needed
      e.target.value = '';
    }
  };

  const filteredMedia = mediaList.filter((m) =>
    m.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <ProtectedRoute
      fallbackTitle="Media Library Access"
      fallbackDescription="Sign in to your workspace to view, upload, and manage marketing creative assets."
    >
      <main className="min-h-screen px-4 py-8 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-[#E4E7EC]">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#E85D2A] flex items-center justify-center shrink-0">
              <ImageIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-[#17202A]">Media Library</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3F2] text-[#E85D2A] border border-[#FECDCA]">
                  Creative Assets
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F9FAFB] text-[#667085] border border-[#E4E7EC]">
                  Local Storage
                </span>
              </div>
              <p className="text-sm text-[#667085] mt-1">
                Upload and manage product images and videos. Used in AI-generated posts and social
                content.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 px-5 py-2.5 bg-[#E85D2A] text-white rounded-xl text-sm font-semibold hover:bg-[#D44D1E] transition-all cursor-pointer shrink-0">
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Product Photos & Video'}
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
              onChange={handleUploadFile}
              disabled={isUploading}
            />
          </label>
        </div>

        {/* Storage Info Banner */}
        <div className="flex items-center gap-3 p-3.5 bg-[#F9FAFB] border border-[#E4E7EC] rounded-xl text-xs text-[#667085]">
          <FolderLock className="h-4 w-4 text-[#E85D2A] shrink-0" />
          <span>
            Files stored on local filesystem. Cloud storage (S3-compatible) will be configured in
            production.
          </span>
        </div>

        {/* Upload success notification */}
        {uploadSuccess && (
          <div className="p-3 rounded-xl bg-[#ECFDF3] border border-[#A6F4C5] text-[#027A48] text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 flex-shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadSuccess(null)}
              className="text-[#027A48] hover:text-[#015C38] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload error notification */}
        {uploadError && (
          <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-center justify-between gap-3">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-[#B42318] hover:text-[#912018] transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tenant Isolation Banner */}
        <div className="p-4 rounded-xl bg-white border border-[#E4E7EC] flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#16803C]/10 text-[#16803C] flex items-center justify-center">
              <FolderLock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#17202A]">Strict Tenant Storage Isolation</h2>
              <p className="text-[11px] text-[#667085]">
                All assets are encrypted at rest and scoped under prefix:{' '}
                <code className="bg-[#F2F4F7] px-1 py-0.5 rounded font-mono text-[#344054]">
                  workspaces/{currentWorkspace?.id || 'workspace'}/media/*
                </code>
              </p>
            </div>
          </div>
          <span className="hidden md:inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold text-[#16803C] bg-[#16803C]/10">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Verified Secure
          </span>
        </div>

        {/* Search and Asset Grid */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-bold text-[#17202A] flex items-center">
              <ImageIcon className="w-4 h-4 mr-2 text-[#E85D2A]" />
              Uploaded Assets ({filteredMedia.length})
            </h2>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-xl border border-[#E4E7EC] pl-9 pr-3 py-2.5 bg-white text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/30"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-[#E4E7EC] p-12 text-center text-xs text-[#667085]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#E85D2A]" />
              Loading media assets...
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="border-2 border-dashed border-[#E4E7EC] rounded-2xl p-12 text-center">
              <div className="flex justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-[#E85D2A]" />
              </div>
              <h3 className="text-sm font-semibold text-[#17202A] mb-1">
                {searchQuery ? `No results for "${searchQuery}"` : 'No media files yet'}
              </h3>
              <p className="text-xs text-[#667085] mb-4">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Upload product images and videos to use in your social content.'}
              </p>
              {!searchQuery && (
                <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#E85D2A] text-white rounded-xl text-sm font-semibold hover:bg-[#D44D1E] transition-all cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Upload Product Photos &amp; Video
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
                    onChange={handleUploadFile}
                    disabled={isUploading}
                  />
                </label>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#E4E7EC] bg-white shadow-sm overflow-hidden hover:border-[#E85D2A]/40 transition-all flex flex-col"
                >
                  {/* Media Thumbnail */}
                  <div className="aspect-video bg-[#F2F4F7] relative overflow-hidden group">
                    <img
                      src={api.resolveMediaUrl(item.url)}
                      alt={item.originalFilename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                    />
                    <div className="absolute top-2 right-2 bg-[#17202A]/80 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[10px] font-mono">
                      {item.width && item.height ? `${item.width}x${item.height}` : item.mimeType}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3
                        className="text-xs font-semibold text-[#17202A] truncate"
                        title={item.originalFilename}
                      >
                        {item.originalFilename}
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-[#667085]">
                        <span>{formatFileSize(item.fileSizeBytes)}</span>
                        <span>&bull;</span>
                        <span className="uppercase text-[10px]">{item.mimeType.split('/')[1]}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E4E7EC] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item)}
                        className="inline-flex items-center text-xs text-[#344054] hover:text-[#E85D2A] transition-all"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-[#16803C]" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            Copy Link
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="inline-flex items-center text-xs text-[#B42318] hover:text-[#912018] transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Studio Link */}
        <div className="pt-4 border-t border-[#E4E7EC]">
          <Link
            href="/ai-studio"
            className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#E85D2A] text-white hover:bg-[#D44D1E] transition-all shadow-sm"
          >
            Open AI Studio &rarr;
          </Link>
        </div>
      </main>
    </ProtectedRoute>
  );
}
