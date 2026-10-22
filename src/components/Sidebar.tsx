import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  FileEdit,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Sliders,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { WorkspaceMetrics, SystemStatus } from '../types/index.ts';

export type NavTab =
  | 'dashboard'
  | 'calendar'
  | 'create'
  | 'scheduled'
  | 'drafts'
  | 'published'
  | 'failed'
  | 'accounts'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  metrics?: WorkspaceMetrics | null;
  systemStatus?: SystemStatus | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  metrics,
  systemStatus,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeVariant?: 'default' | 'danger' | 'warning';
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'create', label: 'Create Post', icon: PlusCircle },
    {
      id: 'scheduled',
      label: 'Scheduled',
      icon: Clock,
      badge: metrics?.scheduled,
      badgeVariant: 'default',
    },
    {
      id: 'drafts',
      label: 'Drafts',
      icon: FileEdit,
      badge: metrics?.drafts,
      badgeVariant: 'default',
    },
    {
      id: 'published',
      label: 'Published',
      icon: CheckCircle2,
      badge: metrics?.published,
      badgeVariant: 'default',
    },
    {
      id: 'failed',
      label: 'Failed Posts',
      icon: AlertTriangle,
      badge: metrics?.failed,
      badgeVariant: 'danger',
    },
    { id: 'accounts', label: 'Connected Accounts', icon: Share2 },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  const isMetaConfigured = systemStatus?.meta.isConfigured;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 z-30 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-stone-50 border-r border-stone-200 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div>
            <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-2">
              Workspace
            </div>
            <nav className="space-y-1" aria-label="Main menu">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-700 hover:bg-stone-200/60 hover:text-stone-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive ? 'text-white' : 'text-stone-500'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold ${
                          item.badgeVariant === 'danger'
                            ? isActive
                              ? 'bg-red-500 text-white'
                              : 'bg-red-100 text-red-700'
                            : isActive
                            ? 'bg-stone-800 text-stone-200'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Integration Status Footer */}
        <div className="p-4 border-t border-stone-200 bg-white/50">
          <button
            type="button"
            onClick={() => handleSelect('settings')}
            className="w-full p-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-left transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              {isMetaConfigured ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              )}
              <div className="flex flex-col">
                <span className="text-xs font-medium text-stone-900">
                  {isMetaConfigured ? 'Meta API Connected' : 'Meta Config Missing'}
                </span>
                <span className="text-[10px] text-stone-500">
                  {isMetaConfigured ? 'Graph API Ready' : 'Setup required'}
                </span>
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                isMetaConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
          </button>
        </div>
      </aside>
    </>
  );
};
