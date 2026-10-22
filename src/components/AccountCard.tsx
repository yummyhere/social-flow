import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { SocialAccount } from '../types/index.ts';
import { apiClient } from '../api/client.ts';

interface AccountCardProps {
  account: SocialAccount;
  onRefresh: () => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onRefresh }) => {
  const [verifying, setVerifying] = useState<boolean>(false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const res = await apiClient.verifyAccount(account.id);
      if (res.status === 'active') {
        setVerifyMessage('Token active and verified with Meta Graph API.');
      } else {
        setVerifyMessage(`Token status: ${res.status}. Action required.`);
      }
      onRefresh();
    } catch (err: any) {
      setVerifyMessage(err.message || 'Verification check failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        `Are you sure you want to disconnect "${account.display_name}"? All encrypted credentials will be permanently erased.`
      )
    ) {
      return;
    }

    setDisconnecting(true);
    try {
      await apiClient.disconnectAccount(account.id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Disconnect failed');
      setDisconnecting(false);
    }
  };

  const isFb = account.platform === 'facebook';

  return (
    <div className="p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                isFb ? 'bg-blue-600' : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600'
              }`}
            >
              {isFb ? 'FB' : 'IG'}
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm truncate max-w-[180px]">
                {account.display_name}
              </h3>
              <p className="text-[11px] text-stone-500 capitalize">
                {account.account_type.replace('_', ' ')}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
              account.connection_status === 'active'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {account.connection_status === 'active' ? (
              <CheckCircle className="w-3 h-3 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-red-600" />
            )}
            <span>{account.connection_status}</span>
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-stone-500 font-mono text-[11px] bg-stone-50 p-3 rounded-xl border border-stone-100">
          <div className="flex justify-between">
            <span className="text-stone-400">Account ID:</span>
            <span className="text-stone-700 truncate max-w-[140px]">{account.platform_account_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Token Storage:</span>
            <span className="text-emerald-700 font-sans font-medium flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              AES-256-GCM
            </span>
          </div>
          {account.last_connection_check && (
            <div className="flex justify-between">
              <span className="text-stone-400">Last Verified:</span>
              <span className="text-stone-700">
                {new Date(account.last_connection_check).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {verifyMessage && (
          <p className="mt-2 text-[11px] text-stone-600 bg-stone-100 p-2 rounded border border-stone-200">
            {verifyMessage}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-5 pt-3 border-t border-stone-100">
        <button
          type="button"
          disabled={verifying}
          onClick={handleVerify}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
          <span>{verifying ? 'Verifying...' : 'Test Connection'}</span>
        </button>

        <button
          type="button"
          disabled={disconnecting}
          onClick={handleDisconnect}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Disconnect</span>
        </button>
      </div>
    </div>
  );
};
