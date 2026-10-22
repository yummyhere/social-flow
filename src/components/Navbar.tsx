import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Plus, User, LogOut, Globe, Menu, X } from 'lucide-react';

interface NavbarProps {
  onOpenCreatePost: () => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreatePost,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      try {
        const timeStr = new Intl.DateTimeFormat('en-US', {
          timeZone: user?.timezone || 'UTC',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now);
        setCurrentTime(timeStr);
      } catch {
        setCurrentTime(now.toTimeString().slice(0, 8));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [user?.timezone]);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-stone-200 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 text-stone-600 hover:text-stone-900 md:hidden rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
          aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm">
            SF
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-stone-900 tracking-tight text-base leading-none">
              SocialFlow
            </span>
            <span className="text-[11px] text-stone-500 font-normal leading-tight mt-0.5">
              Publishing Engine
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real-time Workspace Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 text-xs font-mono">
          <Globe className="w-3.5 h-3.5 text-stone-500" />
          <span>{currentTime || '--:--:--'}</span>
          <span className="text-stone-400">({user?.timezone || 'UTC'})</span>
        </div>

        {/* Quick New Post */}
        <button
          type="button"
          onClick={onOpenCreatePost}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Post</span>
        </button>

        {/* User Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-full text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300"
            aria-expanded={showUserMenu}
            aria-label="User profile menu"
          >
            <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-medium text-xs border border-stone-300">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50 text-xs">
              <div className="px-3.5 py-2 border-b border-stone-100">
                <p className="font-semibold text-stone-900 truncate">{user?.full_name}</p>
                <p className="text-stone-500 truncate text-[11px]">{user?.email}</p>
              </div>
              <div className="px-3.5 py-1.5 text-stone-400 text-[11px]">
                Workspace: {user?.timezone || 'UTC'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full text-left px-3.5 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
