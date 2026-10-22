import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Search,
  Plus,
  ExternalLink,
  RotateCcw,
  Trash2,
  Eye,
} from 'lucide-react';
import { SocialPost } from '../types/index.ts';
import { apiClient } from '../api/client.ts';

interface PostsListPageProps {
  status: 'scheduled' | 'drafts' | 'published' | 'failed';
  posts: SocialPost[];
  onOpenCreatePost: () => void;
  onSelectPost: (postId: string) => void;
  onRefresh: () => void;
}

export const PostsListPage: React.FC<PostsListPageProps> = ({
  status,
  posts,
  onOpenCreatePost,
  onSelectPost,
  onRefresh,
}) => {
  const [search, setSearch] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Map category to backend status
  const filteredPosts = posts.filter((p) => {
    let matchesStatus = false;
    if (status === 'scheduled') matchesStatus = p.status === 'scheduled' || p.status === 'publishing';
    else if (status === 'drafts') matchesStatus = p.status === 'draft';
    else if (status === 'published') matchesStatus = p.status === 'published';
    else if (status === 'failed') matchesStatus = p.status === 'failed' || p.status === 'partially_published';

    if (!matchesStatus) return false;

    if (search.trim()) {
      return (p.caption || '').toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const getTitle = () => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled Posts';
      case 'drafts':
        return 'Draft Posts';
      case 'published':
        return 'Published History';
      case 'failed':
        return 'Failed Publishing Attempts';
    }
  };

  const getSubtitle = () => {
    switch (status) {
      case 'scheduled':
        return 'Posts queued for automatic publishing at their scheduled timestamps';
      case 'drafts':
        return 'Unpublished works in progress';
      case 'published':
        return 'Posts successfully delivered to Facebook and Instagram';
      case 'failed':
        return 'Posts that encountered Meta API errors or missing credentials. Inspect or retry.';
    }
  };

  const handleRetry = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    setActionLoadingId(postId);
    try {
      await apiClient.retryFailedTargets(postId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Retry failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this post?')) return;
    setActionLoadingId(postId);
    try {
      await apiClient.deletePost(postId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            {getTitle()} ({filteredPosts.length})
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">{getSubtitle()}</p>
        </div>

        <button
          type="button"
          onClick={onOpenCreatePost}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Post</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${getTitle().toLowerCase()} by caption...`}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-900"
        />
      </div>

      {/* Post List */}
      {filteredPosts.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50 space-y-3">
          <p className="text-sm font-medium text-stone-700">No {getTitle().toLowerCase()} found</p>
          <p className="text-xs text-stone-400">
            {search ? 'Try clearing your search query.' : 'Create a new post to get started.'}
          </p>
          <button
            type="button"
            onClick={onOpenCreatePost}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Post</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const hasFailed = post.status === 'failed' || post.status === 'partially_published';

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post.id)}
                className="p-4 sm:p-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  {/* Media Thumbnail */}
                  {post.media_urls && post.media_urls.length > 0 ? (
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                      <img
                        src={post.media_urls[0].fullUrl || post.media_urls[0].url}
                        alt="Post thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-stone-100 shrink-0 flex items-center justify-center text-stone-400 border border-stone-200">
                      <FileEdit className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${
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

                      {post.scheduled_at_utc && (
                        <span className="text-xs font-mono text-stone-500">
                          {new Date(post.scheduled_at_utc).toLocaleString('en-US', {
                            timeZone: post.timezone || 'UTC',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}

                      {/* Platforms */}
                      <div className="flex items-center gap-1">
                        {post.targets?.map((t) => (
                          <span
                            key={t.id}
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              t.platform === 'facebook'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {t.platform === 'facebook' ? 'FB' : 'IG'}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm font-medium text-stone-900 line-clamp-2">
                      {post.caption || 'No text caption'}
                    </p>

                    {/* Target error summary if failed */}
                    {hasFailed && post.targets && (
                      <div className="text-[11px] text-red-600 truncate">
                        {post.targets.find((t) => t.target_status === 'failed')?.last_error_message ||
                          'Publishing attempt failed. View details for error code.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {hasFailed && (
                    <button
                      type="button"
                      disabled={actionLoadingId === post.id}
                      onClick={(e) => handleRetry(e, post.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                      title="Retry failed targets"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectPost(post.id)}
                    className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-medium"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    disabled={actionLoadingId === post.id}
                    onClick={(e) => handleDelete(e, post.id)}
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
