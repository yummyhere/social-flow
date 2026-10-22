import React, { useState } from 'react';
import { Sliders, User, Globe, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { SystemStatus } from '../types/index.ts';
import { apiClient } from '../api/client.ts';
import { SystemDiagnostics } from '../components/SystemDiagnostics.tsx';

interface SettingsPageProps {
  systemStatus: SystemStatus | null;
  onRefreshSystemStatus: () => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  systemStatus,
  onRefreshSystemStatus,
}) => {
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState<string>(user?.full_name || '');
  const [timezone, setTimezone] = useState<string>(user?.timezone || 'UTC');
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiClient.updateProfile({
        full_name: fullName,
        timezone,
      });
      updateUser(res.user);
      setSuccessMessage('Workspace profile updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-150 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          Settings & Infrastructure
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Manage your workspace preferences, timezone, and inspect live Meta Graph API configurations
        </p>
      </div>

      {/* Workspace Preferences Form */}
      <div className="p-6 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-6">
        <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
          <User className="w-5 h-5 text-stone-700" />
          <h2 className="text-sm font-semibold text-stone-900">User & Workspace Preferences</h2>
        </div>

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                Account Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full p-2.5 rounded-xl border border-stone-200 bg-stone-50 text-xs sm:text-sm text-stone-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
              Workspace Default Timezone
            </label>
            <div className="relative">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-white"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-stone-400 mt-1">
              All scheduled posts will display in this timezone while storing exact UTC timestamps in the database.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs sm:text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Meta API & System Diagnostics */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-stone-900 tracking-tight">
          System Infrastructure & Meta Integrations
        </h2>
        <SystemDiagnostics status={systemStatus} onRefresh={onRefreshSystemStatus} />
      </div>
    </div>
  );
};
