import React, { useState } from 'react';
import {
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Send,
  Calendar,
  Trash2,
  FileEdit,
  Globe,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SocialPost, PostTarget, PublishingAttempt } from '../types/index.ts';
import { apiClient } from '../api/client.ts';

interface PostDetailModalProps {
  post: SocialPost;
  onClose: () => void;
  onEdit: (post: SocialPost) => void;
  onRefresh: () => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  onClose,
  onEdit,
  onRefresh,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState<boolean>(false);
  const [newScheduleDate, setNewScheduleDate] = useState<string>(
    post.scheduled_at_utc ? post.scheduled_at_utc.split('T')[0] : ''
  );
  const [newScheduleTime, setNewScheduleTime] = useState<string>(
    post.scheduled_at_utc ? post.scheduled_at_utc.split('T')[1]?.slice(0, 5) : '09:00'
  );
  const [expandedAttempts, setExpandedAttempts] = useState<string[]>([]);

  const toggleAttempt = (id: string) => {
    if (expandedAttempts.includes(id)) {
      setExpandedAttempts(expandedAttempts.filter((a) => a !== id));
    } else {
      setExpandedAttempts([...expandedAttempts, id]);
    }
  };

  const handlePublishNow = async () => {
    setLoadingAction('publish_now');
    setErrorMessage(null);
    try {
      await apiClient.publishNow(post.id);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Publish now failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRetryFailed = async () => {
    setLoadingAction('retry');
    setErrorMessage(null);
    try {
      await apiClient.retryFailedTargets(post.id);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Retry failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelPost = async () => {
    setLoadingAction('cancel');
    setErrorMessage(null);
    try {
      await apiClient.cancelPost(post.id);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Cancel failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReschedule = async () => {
    if (!newScheduleDate || !newScheduleTime) return;
    const combined = new Date(`${newScheduleDate}T${newScheduleTime}:00`);
    if (isNaN(combined.getTime())) {
      setErrorMessage('Invalid date/time');
      return;
    }

    setLoadingAction('reschedule');
    setErrorMessage(null);
    try {
      await apiClient.reschedulePost(post.id, combined.toISOString());
      setShowReschedule(false);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Reschedule failed.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    setLoadingAction('delete');
    try {
      await apiClient.deletePost(post.id);
      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Delete failed.');
      setLoadingAction(null);
    }
  };

  const hasFailedTargets = post.targets?.some((t) => t.target_status === 'failed');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                post.status === 'published'
                  ? 'bg-emerald-100 text-emerald-800'
                  : post.status === 'scheduled'
                  ? 'bg-blue-100 text-blue-800'
                  : post.status === 'partially_published'
                  ? 'bg-amber-100 text-amber-800'
                  : post.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-stone-100 text-stone-700'
              }`}
            >
              {post.status.replace('_', ' ')}
            </span>

            <span className="text-xs font-mono text-stone-400">ID: {post.id.slice(0, 8)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(post)}
              className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <FileEdit className="w-4 h-4" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Caption & Media */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Post Content</h4>
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-800 whitespace-pre-wrap">
              {post.caption || <span className="text-stone-400 italic">No text caption</span>}
            </div>

            {post.media_urls && post.media_urls.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {post.media_urls.map((m, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border border-stone-200 bg-stone-100 aspect-video">
                    {m.mime_type.startsWith('video/') ? (
                      <video src={m.fullUrl || m.url} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.fullUrl || m.url} alt="Attached media" className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Info */}
          <div className="p-4 bg-stone-50/70 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-stone-600">
              <Clock className="w-4 h-4 text-stone-400" />
              <span>
                Scheduled For:{' '}
                <strong className="text-stone-900">
                  {post.scheduled_at_utc
                    ? new Date(post.scheduled_at_utc).toLocaleString('en-US', {
                        timeZone: post.timezone || 'UTC',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Not scheduled (Draft)'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-stone-500 font-mono">
              <Globe className="w-3.5 h-3.5" />
              <span>{post.timezone || 'UTC'}</span>
            </div>
          </div>

          {/* Target Accounts Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Publishing Targets & Platform Status
            </h4>

            <div className="space-y-2">
              {post.targets?.map((target) => (
                <div
                  key={target.id}
                  className="p-3.5 rounded-xl border border-stone-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        target.platform === 'facebook' ? 'bg-blue-600' : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-stone-900 text-xs">
                        {target.display_name}
                      </div>
                      <div className="text-[11px] text-stone-500 capitalize">
                        {target.platform} · {target.account_type?.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        target.target_status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : target.target_status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : target.target_status === 'publishing'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {target.target_status}
                    </span>

                    {target.external_post_url && (
                      <a
                        href={target.external_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <span>View Post</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Publishing Attempts Audit Trail */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Execution Audit Log ({post.attempts?.length || 0} attempts)
            </h4>

            {post.attempts && post.attempts.length > 0 ? (
              <div className="space-y-2">
                {post.attempts.map((attempt) => {
                  const isExpanded = expandedAttempts.includes(attempt.id);
                  return (
                    <div
                      key={attempt.id}
                      className="border border-stone-200 rounded-xl overflow-hidden bg-stone-50/50 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAttempt(attempt.id)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-stone-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                          )}
                          <span
                            className={`w-2 h-2 rounded-full ${
                              attempt.result === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                          <span className="font-semibold text-stone-900">
                            Attempt #{attempt.attempt_number} ({attempt.display_name || attempt.platform})
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-mono text-stone-500">
                            {new Date(attempt.started_at).toLocaleTimeString()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              attempt.result === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {attempt.result}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-3 bg-white border-t border-stone-200 space-y-2 text-[11px] font-mono">
                          {attempt.error_code && (
                            <div>
                              <span className="text-red-600 font-bold">Error Code:</span> {attempt.error_code}
                            </div>
                          )}
                          {attempt.error_message && (
                            <div className="text-red-700 bg-red-50 p-2 rounded border border-red-100">
                              {attempt.error_message}
                            </div>
                          )}
                          <div>
                            <span className="text-stone-500 font-bold">Request Summary:</span>
                            <pre className="p-2 bg-stone-100 rounded text-stone-800 mt-1 overflow-x-auto">
                              {attempt.api_request_summary}
                            </pre>
                          </div>
                          <div>
                            <span className="text-stone-500 font-bold">Response Summary:</span>
                            <pre className="p-2 bg-stone-100 rounded text-stone-800 mt-1 overflow-x-auto">
                              {attempt.api_response_summary}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">No publishing attempts executed yet.</p>
            )}
          </div>

          {/* Reschedule Picker Modal/Drawer */}
          {showReschedule && (
            <div className="p-4 bg-stone-100 rounded-xl border border-stone-300 space-y-3">
              <h5 className="text-xs font-semibold text-stone-900">Select New Schedule Time</h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={newScheduleDate}
                    onChange={(e) => setNewScheduleDate(e.target.value)}
                    className="w-full p-2 bg-white rounded border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Time</label>
                  <input
                    type="time"
                    value={newScheduleTime}
                    onChange={(e) => setNewScheduleTime(e.target.value)}
                    className="w-full p-2 bg-white rounded border border-stone-300 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReschedule(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loadingAction === 'reschedule'}
                  onClick={handleReschedule}
                  className="px-3 py-1.5 bg-stone-900 text-white text-xs font-medium rounded hover:bg-stone-800"
                >
                  {loadingAction === 'reschedule' ? 'Updating...' : 'Confirm Reschedule'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loadingAction === 'delete'}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Post</span>
          </button>

          <div className="flex items-center gap-2">
            {hasFailedTargets && (
              <button
                type="button"
                disabled={loadingAction === 'retry'}
                onClick={handleRetryFailed}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{loadingAction === 'retry' ? 'Retrying...' : 'Retry Failed Targets'}</span>
              </button>
            )}

            {post.status === 'scheduled' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowReschedule(!showReschedule)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg text-xs font-medium transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Reschedule</span>
                </button>

                <button
                  type="button"
                  disabled={loadingAction === 'cancel'}
                  onClick={handleCancelPost}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 rounded-lg text-xs font-medium transition-colors"
                >
                  <span>{loadingAction === 'cancel' ? 'Cancelling...' : 'Cancel Post'}</span>
                </button>
              </>
            )}

            {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
              <button
                type="button"
                disabled={loadingAction === 'publish_now'}
                onClick={handlePublishNow}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loadingAction === 'publish_now' ? 'Publishing...' : 'Publish Now'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
