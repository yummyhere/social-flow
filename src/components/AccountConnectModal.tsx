import React, { useState } from 'react';
import {
  X,
  Share2,
  Key,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../api/client.ts';
import { SystemStatus } from '../types/index.ts';

interface AccountConnectModalProps {
  systemStatus?: SystemStatus | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const AccountConnectModal: React.FC<AccountConnectModalProps> = ({
  systemStatus,
  onClose,
  onSuccess,
}) => {
  const [connectTab, setConnectTab] = useState<'oauth' | 'manual'>('oauth');

  // Manual token state
  const [tokenInput, setTokenInput] = useState<string>('');
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [displayName, setDisplayName] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMetaConfigured = systemStatus?.meta.isConfigured;

  const handleOAuthConnect = async () => {
    setErrorMessage(null);
    try {
      const res = await apiClient.initiateMetaConnect();
      if (res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Meta OAuth');
    }
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setErrorMessage('Please enter an authorized access token.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await apiClient.connectDirectToken({
        token: tokenInput.trim(),
        platform,
        displayName: displayName.trim() || undefined,
        accountId: accountId.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Token verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900">Connect Social Media Account</h2>
              <p className="text-xs text-stone-500">Facebook Pages & Instagram Professional accounts</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-stone-200 bg-stone-50 text-xs font-medium">
          <button
            type="button"
            onClick={() => setConnectTab('oauth')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              connectTab === 'oauth'
                ? 'border-stone-900 text-stone-900 font-semibold bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Official Meta OAuth
          </button>
          <button
            type="button"
            onClick={() => setConnectTab('manual')}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              connectTab === 'manual'
                ? 'border-stone-900 text-stone-900 font-semibold bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Direct Token Connect (Developer / System User)
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {connectTab === 'oauth' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3 text-xs">
                <h4 className="font-semibold text-stone-900">Supported Meta Accounts</h4>
                <ul className="space-y-1.5 text-stone-600 list-disc list-inside">
                  <li>Facebook Pages where you have Task or Admin permissions</li>
                  <li>Connected Instagram Business or Creator accounts</li>
                  <li>Automated Graph API token refresh and long-lived token storage</li>
                </ul>
              </div>

              {!isMetaConfigured ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Meta API Credentials Required</span>
                  </div>
                  <p className="leading-relaxed">
                    To use the browser OAuth popup flow, add your Meta Developer credentials (
                    <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">META_APP_ID</code> and{' '}
                    <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">META_APP_SECRET</code>
                    ) to your deployment environment variables.
                  </p>
                  <p className="text-[11px] text-amber-800">
                    You can also use the <strong>Direct Token Connect</strong> tab to connect using a Page Access Token immediately.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Meta App ID is active and ready for OAuth authorization.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleOAuthConnect}
                disabled={!isMetaConfigured}
                className="w-full py-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-medium text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Log In With Facebook to Connect Pages & Instagram</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleManualTokenSubmit} className="space-y-4">
              {/* Step-by-Step Helper Card */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs text-blue-950 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-blue-900">
                    <Key className="w-3.5 h-3.5 text-blue-700" />
                    Token Kaise Hasil Karein? (Where to find token)
                  </span>
                  <a
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-medium transition-colors shadow-2xs"
                  >
                    <span>Open Meta Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <ol className="space-y-1 text-[11px] text-blue-900 list-decimal list-inside leading-relaxed">
                  <li>
                    Upar <strong>"Open Meta Explorer"</strong> button par click karein.
                  </li>
                  <li>
                    Wahan right side par <strong>"User or Page"</strong> dropdown se apna <strong>Facebook Page</strong> select karein.
                  </li>
                  <li>
                    Blue button <strong>"Generate Access Token"</strong> dabayein aur <strong>"Access Token"</strong> box se token copy karke neeche paste kar dein.
                  </li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Platform
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatform('facebook')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all ${
                      platform === 'facebook'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-semibold'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Facebook Page
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('instagram')}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all ${
                      platform === 'instagram'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 font-semibold'
                        : 'border-stone-200 bg-stone-50 text-stone-700'
                    }`}
                  >
                    Instagram Professional
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Display Name (e.g. Acme Brand Page)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Official Brand Account"
                  className="w-full p-2.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Platform Account / Page ID (Optional)
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. 1029384756"
                  className="w-full p-2.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Access Token
                </label>
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste Meta Access Token (EAA...)"
                  rows={3}
                  className="w-full p-2.5 font-mono text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Verifying & Saving...' : 'Encrypt & Connect Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
