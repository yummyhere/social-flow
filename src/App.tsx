import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { PostComposer } from './components/PostComposer.tsx';
import { PostDetailModal } from './components/PostDetailModal.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PostsListPage } from './pages/PostsListPage.tsx';
import { AccountsPage } from './pages/AccountsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { AuthPages } from './pages/AuthPages.tsx';
import { SocialPost, SocialAccount, WorkspaceMetrics, SystemStatus } from './types/index.ts';
import { apiClient } from './api/client.ts';

function MainApplication() {
  const { user, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Core Data
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  // Modals
  const [composerOpen, setComposerOpen] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [composerPrefilledDate, setComposerPrefilledDate] = useState<string | undefined>();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState<SocialPost | null>(null);

  const refreshData = async () => {
    if (!user) return;
    try {
      const [postsRes, accountsRes, statusRes] = await Promise.all([
        apiClient.getPosts(),
        apiClient.getAccounts(),
        apiClient.getSystemStatus(),
      ]);

      setPosts(postsRes.posts || []);
      setMetrics(postsRes.metrics || null);
      setAccounts(accountsRes.accounts || []);
      setSystemStatus(statusRes || null);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshData();
      // Poll periodically to keep scheduled statuses and attempt logs fresh
      const interval = setInterval(refreshData, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Open detail modal when a post is clicked
  useEffect(() => {
    if (selectedPostId) {
      apiClient
        .getPost(selectedPostId)
        .then((res) => setSelectedPostDetail(res.post))
        .catch(() => setSelectedPostId(null));
    } else {
      setSelectedPostDetail(null);
    }
  }, [selectedPostId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-sm animate-pulse">
            SF
          </div>
          <span className="text-xs text-stone-500 font-medium">Initializing workspace...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPages />;
  }

  const handleOpenCreatePost = (prefilledDate?: string) => {
    setEditingPost(null);
    setComposerPrefilledDate(prefilledDate);
    setComposerOpen(true);
  };

  const handleEditPost = (post: SocialPost) => {
    setSelectedPostId(null);
    setEditingPost(post);
    setComposerOpen(true);
  };

  return (
    <div className="min-h-screen bg-stone-100/50 flex flex-col font-sans antialiased text-stone-900">
      <Navbar
        onOpenCreatePost={() => handleOpenCreatePost()}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <div className="flex-1 flex">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'create') {
              handleOpenCreatePost();
            } else {
              setCurrentTab(tab);
            }
          }}
          metrics={metrics}
          systemStatus={systemStatus}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 md:ml-64 min-w-0">
          <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {currentTab === 'dashboard' && (
              <DashboardPage
                metrics={metrics}
                posts={posts}
                accounts={accounts}
                onOpenCreatePost={() => handleOpenCreatePost()}
                onSelectPost={(id) => setSelectedPostId(id)}
                onNavigateTab={(tab) => setCurrentTab(tab)}
              />
            )}

          {currentTab === 'calendar' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                    Content Calendar
                  </h1>
                  <p className="text-xs sm:text-sm text-stone-500 mt-1">
                    Visual multi-platform scheduling grid across Facebook and Instagram
                  </p>
                </div>
              </div>

              <CalendarView
                accounts={accounts}
                onOpenCreatePost={(date) => handleOpenCreatePost(date)}
                onSelectPost={(id) => setSelectedPostId(id)}
              />
            </div>
          )}

          {currentTab === 'scheduled' && (
            <PostsListPage
              status="scheduled"
              posts={posts}
              onOpenCreatePost={() => handleOpenCreatePost()}
              onSelectPost={(id) => setSelectedPostId(id)}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'drafts' && (
            <PostsListPage
              status="drafts"
              posts={posts}
              onOpenCreatePost={() => handleOpenCreatePost()}
              onSelectPost={(id) => setSelectedPostId(id)}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'published' && (
            <PostsListPage
              status="published"
              posts={posts}
              onOpenCreatePost={() => handleOpenCreatePost()}
              onSelectPost={(id) => setSelectedPostId(id)}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'failed' && (
            <PostsListPage
              status="failed"
              posts={posts}
              onOpenCreatePost={() => handleOpenCreatePost()}
              onSelectPost={(id) => setSelectedPostId(id)}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsPage
              accounts={accounts}
              systemStatus={systemStatus}
              onRefresh={refreshData}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              systemStatus={systemStatus}
              onRefreshSystemStatus={refreshData}
            />
          )}
          </main>
        </div>
      </div>

      {/* Post Composer Modal */}
      {composerOpen && (
        <PostComposer
          accounts={accounts}
          initialPost={editingPost}
          prefilledDate={composerPrefilledDate}
          onClose={() => setComposerOpen(false)}
          onPostSaved={refreshData}
        />
      )}

      {/* Post Details & Attempts Modal */}
      {selectedPostDetail && (
        <PostDetailModal
          post={selectedPostDetail}
          onClose={() => setSelectedPostId(null)}
          onEdit={handleEditPost}
          onRefresh={refreshData}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
}
