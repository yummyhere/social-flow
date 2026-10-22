import React, { useState, useEffect } from 'react';
import { Share2, Plus, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SocialAccount, SystemStatus } from '../types/index.ts';
import { AccountCard } from '../components/AccountCard.tsx';
import { AccountConnectModal } from '../components/AccountConnectModal.tsx';

interface AccountsPageProps {
  accounts: SocialAccount[];
  systemStatus?: SystemStatus | null;
  onRefresh: () => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  accounts,
  systemStatus,
  onRefresh,
}) => {
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [callbackBanner, setCallbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Check URL parameters for OAuth redirect results
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      const connectedCount = params.get('connected') || '1';
      setCallbackBanner({
        type: 'success',
        message: `Successfully connected ${connectedCount} social account(s) via Meta OAuth!`,
      });
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      onRefresh();
    } else if (params.get('error')) {
      setCallbackBanner({
        type: 'error',
        message: `Meta Connection Error: ${params.get('error')}`,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Connected Social Accounts ({accounts.length})
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Authorized Facebook Pages and eligible Instagram professional accounts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowConnectModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Account</span>
        </button>
      </div>

      {/* OAuth Callback Alert */}
      {callbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            callbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {callbackBanner.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{callbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setCallbackBanner(null)}
            className="text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Security info banner */}
      <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex items-start gap-3 text-xs text-stone-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-stone-800">Token Protection & Isolation:</span>
          <p className="mt-0.5">
            Every access token is encrypted at rest using server-side AES-256-GCM authenticated encryption. Tokens are never exposed to browser frontends or client logs.
          </p>
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <Share2 className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-semibold text-stone-800">No social media accounts connected</h3>
            <p className="text-xs text-stone-500 mt-1">
              Connect your authorized Facebook Pages or eligible Instagram Business accounts to start scheduling posts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-medium shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Connect First Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} onRefresh={onRefresh} />
          ))}
        </div>
      )}

      {showConnectModal && (
        <AccountConnectModal
          systemStatus={systemStatus}
          onClose={() => setShowConnectModal(false)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
};
