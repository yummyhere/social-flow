import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Database,
  Globe,
  Clock,
  CheckCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { SystemStatus } from '../types/index.ts';

interface SystemDiagnosticsProps {
  status: SystemStatus | null;
  onRefresh?: () => void;
}

export const SystemDiagnostics: React.FC<SystemDiagnosticsProps> = ({ status, onRefresh }) => {
  if (!status) return null;

  const isMetaReady = status.meta.isConfigured;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard: ' + text);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Meta Integration Status */}
        <div className="p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Meta Graph API
            </span>
            {isMetaReady ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                Missing Env Vars
              </span>
            )}
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>App ID:</span>
              <span className="font-mono">{status.meta.appIdMasked}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>API Version:</span>
              <span className="font-mono">{status.meta.apiVersion}</span>
            </div>
          </div>
        </div>

        {/* Scheduler Worker Status */}
        <div className="p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Background Scheduler
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Cpu className="w-3 h-3 text-emerald-600" />
              Active
            </span>
          </div>
          <div className="space-y-1 text-xs font-mono text-stone-600">
            <div className="flex justify-between">
              <span>Worker:</span>
              <span>{status.scheduler.workerId}</span>
            </div>
            <div className="flex justify-between">
              <span>Jobs Processed:</span>
              <span>{status.scheduler.totalProcessedCount}</span>
            </div>
          </div>
        </div>

        {/* Database & Isolation */}
        <div className="p-5 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Persistence Engine
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Database className="w-3 h-3 text-emerald-600" />
              Durable SQLite
            </span>
          </div>
          <div className="space-y-1 text-xs text-stone-600">
            <div className="flex justify-between">
              <span>Posts Recorded:</span>
              <span className="font-mono">{status.database.stats.posts}</span>
            </div>
            <div className="flex justify-between">
              <span>Publishing Attempts:</span>
              <span className="font-mono">{status.database.stats.publishingAttempts}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta Developer Setup Instructions */}
      <div className="p-6 rounded-2xl border border-stone-200 bg-stone-50 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">{status.metaSetupInstructions.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Follow these steps to connect your Meta Developer App for production Facebook & Instagram publishing
            </p>
          </div>
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <span>Meta Developer Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Copyable Redirect URI */}
        <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1">
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
            Valid OAuth Redirect URI
          </span>
          <div className="flex items-center justify-between gap-2">
            <code className="text-xs font-mono text-stone-800 truncate">
              {status.meta.redirectUri}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(status.meta.redirectUri)}
              className="p-1.5 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-100"
              title="Copy redirect URI"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-2">
          {status.metaSetupInstructions.steps.map((step, idx) => (
            <div key={idx} className="text-xs text-stone-700 bg-white/70 p-2.5 rounded-lg border border-stone-100">
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
