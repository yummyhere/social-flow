import React from 'react';
import {
  Clock,
  CheckCircle2,
  FileEdit,
  AlertTriangle,
  Plus,
  ArrowRight,
  Share2,
  ExternalLink,
} from 'lucide-react';
import { SocialPost, SocialAccount, WorkspaceMetrics } from '../types/index.ts';

interface DashboardPageProps {
  metrics: WorkspaceMetrics | null;
  posts: SocialPost[];
  accounts: SocialAccount[];
  onOpenCreatePost: () => void;
  onSelectPost: (postId: string) => void;
  onNavigateTab: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  metrics,
  posts,
  accounts,
  onOpenCreatePost,
  onSelectPost,
  onNavigateTab,
}) => {
  const scheduledPosts = posts
    .filter((p) => p.status === 'scheduled')
    .sort((a, b) => (a.scheduled_at_utc || '').localeCompare(b.scheduled_at_utc || ''));

  const recentHistory = posts
    .filter((p) => p.status === 'published' || p.status === 'failed' || p.status === 'partially_published')
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Welcome / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Workspace Overview
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Real-time social media scheduling and auto-publishing metrics
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreatePost}
          className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Post</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scheduled */}
        <div
          onClick={() => onNavigateTab('scheduled')}
          className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 cursor-pointer transition-all shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Scheduled
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-mono">
            {metrics?.scheduled || 0}
          </div>
          <p className="text-[11px] text-stone-400">Due for automatic release</p>
        </div>

        {/* Published */}
        <div
          onClick={() => onNavigateTab('published')}
          className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 cursor-pointer transition-all shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Published
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-mono">
            {metrics?.published || 0}
          </div>
          <p className="text-[11px] text-stone-400">Live across channels</p>
        </div>

        {/* Drafts */}
        <div
          onClick={() => onNavigateTab('drafts')}
          className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 cursor-pointer transition-all shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Drafts
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
              <FileEdit className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-mono">
            {metrics?.drafts || 0}
          </div>
          <p className="text-[11px] text-stone-400">Work in progress</p>
        </div>

        {/* Failed */}
        <div
          onClick={() => onNavigateTab('failed')}
          className="p-5 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 cursor-pointer transition-all shadow-2xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Failed
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight font-mono">
            {metrics?.failed || 0}
          </div>
          <p className="text-[11px] text-stone-400">Requires retry or token fix</p>
        </div>
      </div>

      {/* Main Grid: Upcoming Scheduled Posts & Connected Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upcoming Scheduled Posts (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-stone-900 tracking-tight">
              Upcoming Scheduled Posts
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('scheduled')}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {scheduledPosts.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 text-center space-y-3">
              <Clock className="w-8 h-8 mx-auto text-stone-400" />
              <div>
                <p className="text-xs font-medium text-stone-700">No upcoming posts scheduled</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Compose a post and schedule it on the calendar for auto-publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCreatePost}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-300 text-stone-700 rounded-lg text-xs font-medium hover:bg-stone-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule First Post</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledPosts.slice(0, 4).map((post) => (
                <div
                  key={post.id}
                  onClick={() => onSelectPost(post.id)}
                  className="p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-all flex items-start gap-4 shadow-2xs"
                >
                  {/* Thumbnail if media exists */}
                  {post.media_urls && post.media_urls.length > 0 ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                      <img
                        src={post.media_urls[0].fullUrl || post.media_urls[0].url}
                        alt="Post thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-stone-100 shrink-0 flex items-center justify-center text-stone-400 border border-stone-200">
                      <FileEdit className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-mono font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {post.scheduled_at_utc
                          ? new Date(post.scheduled_at_utc).toLocaleString('en-US', {
                              timeZone: post.timezone || 'UTC',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Scheduled'}
                      </span>

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

                    <p className="text-xs text-stone-900 font-medium line-clamp-2">
                      {post.caption || 'No caption'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Connected Accounts & Recent History (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Connected Accounts Widget */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-stone-900 tracking-tight">
                Connected Accounts ({accounts.length})
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('accounts')}
                className="text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Manage
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="p-5 rounded-2xl border border-stone-200 bg-stone-50 text-center space-y-2">
                <Share2 className="w-6 h-6 mx-auto text-stone-400" />
                <p className="text-xs text-stone-600">No social accounts connected</p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('accounts')}
                  className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800"
                >
                  Connect Account
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3 rounded-xl border border-stone-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] text-white ${
                          acc.platform === 'facebook'
                            ? 'bg-blue-600'
                            : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600'
                        }`}
                      >
                        {acc.platform === 'facebook' ? 'FB' : 'IG'}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-stone-900 truncate max-w-[160px]">
                          {acc.display_name}
                        </p>
                        <p className="text-[10px] text-stone-400 capitalize">
                          {acc.account_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${
                        acc.connection_status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {acc.connection_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Publishing Activity */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-stone-900 tracking-tight">
              Recent Activity
            </h2>

            {recentHistory.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No published or failed post history yet.</p>
            ) : (
              <div className="space-y-2">
                {recentHistory.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onSelectPost(p.id)}
                    className="p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-400 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-stone-900 truncate">{p.caption || 'Untitled post'}</p>
                      <p className="text-[10px] text-stone-400">
                        {p.published_at
                          ? `Published ${new Date(p.published_at).toLocaleTimeString()}`
                          : `Updated ${new Date(p.updated_at).toLocaleTimeString()}`}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                        p.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.status === 'partially_published'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {p.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
