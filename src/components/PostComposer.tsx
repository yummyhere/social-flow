import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Calendar,
  Clock,
  Globe,
  AlertCircle,
  CheckCircle,
  Image as ImageIcon,
  Video,
  Send,
  Save,
  Check,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react';
import { SocialAccount, MediaItem, SocialPost } from '../types/index.ts';
import { apiClient } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  validateFacebookPost,
  validateInstagramPost,
  PLATFORM_LIMITS,
} from '../utils/validation.ts';

interface PostComposerProps {
  accounts: SocialAccount[];
  initialPost?: SocialPost | null;
  prefilledDate?: string;
  onClose: () => void;
  onPostSaved: () => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({
  accounts,
  initialPost,
  prefilledDate,
  onClose,
  onPostSaved,
}) => {
  const { user } = useAuth();

  const [caption, setCaption] = useState<string>(initialPost?.caption || '');
  const [mediaList, setMediaList] = useState<MediaItem[]>(initialPost?.media_urls || []);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    initialPost?.targets?.map((t) => t.social_account_id) || []
  );

  // Time & scheduling
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    if (initialPost?.scheduled_at_utc) {
      return initialPost.scheduled_at_utc.split('T')[0];
    }
    if (prefilledDate) {
      return prefilledDate;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [scheduleTime, setScheduleTime] = useState<string>(() => {
    if (initialPost?.scheduled_at_utc) {
      const timePart = initialPost.scheduled_at_utc.split('T')[1];
      return timePart ? timePart.slice(0, 5) : '09:00';
    }
    return '09:00';
  });

  const [timezone, setTimezone] = useState<string>(
    initialPost?.timezone || user?.timezone || 'UTC'
  );

  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pre-select all available accounts by default if creating a new post and none selected
  useEffect(() => {
    if (!initialPost && selectedAccountIds.length === 0 && accounts.length > 0) {
      setSelectedAccountIds(accounts.map((a) => a.id));
    }
  }, [accounts, initialPost]);

  // Selected accounts objects
  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));
  const hasFacebook = selectedAccounts.some((a) => a.platform === 'facebook');
  const hasInstagram = selectedAccounts.some((a) => a.platform === 'instagram');

  // Platform validation
  const fbValidation = validateFacebookPost(caption, mediaList);
  const igValidation = validateInstagramPost(caption, mediaList);

  const handleToggleAccount = (id: string) => {
    if (selectedAccountIds.includes(id)) {
      setSelectedAccountIds(selectedAccountIds.filter((item) => item !== id));
    } else {
      setSelectedAccountIds([...selectedAccountIds, id]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(10);
    setFormError(null);

    try {
      const uploadedItems: MediaItem[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(Math.round(((i + 1) / files.length) * 90));
        const item = await apiClient.uploadMedia(files[i]);
        uploadedItems.push(item);
      }
      setMediaList([...mediaList, ...uploadedItems]);
      setUploadProgress(100);
    } catch (err: any) {
      setFormError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList(mediaList.filter((_, i) => i !== index));
  };

  const handleSave = async (action: 'draft' | 'schedule' | 'publish_now') => {
    setFormError(null);

    if (selectedAccountIds.length === 0) {
      setFormError('Please select at least one social media account to publish to.');
      return;
    }

    if (action !== 'draft') {
      if (hasInstagram && !igValidation.isValid) {
        setFormError(igValidation.errors[0]);
        return;
      }
      if (hasFacebook && !fbValidation.isValid) {
        setFormError(fbValidation.errors[0]);
        return;
      }
    }

    let scheduledUtc: string | null = null;
    if (action === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        setFormError('Please select both date and time for scheduling.');
        return;
      }
      // Combine date and time
      const dateObj = new Date(`${scheduleDate}T${scheduleTime}:00`);
      if (isNaN(dateObj.getTime())) {
        setFormError('Invalid date or time.');
        return;
      }
      if (dateObj.getTime() < Date.now() - 60000) {
        setFormError('Scheduled time cannot be in the past. Use Publish Now instead.');
        return;
      }
      scheduledUtc = dateObj.toISOString();
    } else if (action === 'publish_now') {
      scheduledUtc = new Date().toISOString();
    }

    setSubmitting(true);
    try {
      if (initialPost) {
        // Update existing post
        await apiClient.updatePost(initialPost.id, {
          caption,
          media_urls: mediaList,
          timezone,
          scheduled_at_utc: scheduledUtc,
          status: action === 'draft' ? 'draft' : 'scheduled',
          target_account_ids: selectedAccountIds,
        });

        if (action === 'publish_now') {
          await apiClient.publishNow(initialPost.id);
        }
      } else {
        // Create new post
        await apiClient.createPost({
          caption,
          media_urls: mediaList,
          timezone,
          scheduled_at_utc: scheduledUtc,
          status: action === 'draft' ? 'draft' : 'scheduled',
          target_account_ids: selectedAccountIds,
          publish_now: action === 'publish_now',
        });
      }

      onPostSaved();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save post.');
    } finally {
      setSubmitting(false);
    }
  };

  // Hashtag count
  const hashtagCount = (caption.match(/#[a-zA-Z0-9_]+/g) || []).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 tracking-tight">
              {initialPost ? 'Edit Post' : 'Compose Social Post'}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Publish or schedule across Facebook Pages and Instagram Professional accounts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Close composer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form Controls (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Account Selector */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Publishing Destinations
              </label>

              {accounts.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">No social accounts connected yet.</span>
                    <p className="mt-0.5">
                      Connect your Facebook Page or Instagram Professional account in the Connected Accounts tab first.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountIds.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleToggleAccount(acc.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          isSelected
                            ? acc.platform === 'facebook'
                              ? 'bg-blue-50 border-blue-300 text-blue-900'
                              : 'bg-rose-50 border-rose-300 text-rose-900'
                            : 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            acc.platform === 'facebook' ? 'bg-blue-600' : 'bg-rose-500'
                          }`}
                        />
                        <span>{acc.display_name}</span>
                        <span className="text-[10px] text-stone-400 uppercase font-mono">
                          {acc.platform === 'facebook' ? 'FB' : 'IG'}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-stone-700" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Caption Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Post Caption
                </label>
                <div className="flex items-center gap-3 text-[11px] font-mono text-stone-500">
                  <span>
                    Hashtags: <strong className={hashtagCount > 30 ? 'text-red-600' : 'text-stone-700'}>{hashtagCount}/30</strong>
                  </span>
                  <span>
                    Length: <strong className={caption.length > 2200 && hasInstagram ? 'text-amber-600' : 'text-stone-700'}>{caption.length}</strong>
                  </span>
                </div>
              </div>

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What would you like to share? Write your caption, links, and #hashtags..."
                rows={5}
                className="w-full p-3.5 rounded-xl border border-stone-300 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm text-stone-900 placeholder:text-stone-400 resize-y"
              />
            </div>

            {/* Media Upload & Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  Media Attachments
                </label>
                <span className="text-[11px] text-stone-400">
                  {mediaList.length} / 10 items
                </span>
              </div>

              {/* Upload Drop Area */}
              <div className="relative border-2 border-dashed border-stone-200 hover:border-stone-400 rounded-xl p-4 text-center transition-colors bg-stone-50/50">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  title="Upload photos or videos"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Upload className="w-5 h-5 text-stone-400" />
                  <p className="text-xs font-medium text-stone-700">
                    Click or drag files here to upload
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Supports JPEG, PNG, MP4, MOV (up to 100MB)
                  </p>
                </div>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-stone-900 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 font-mono text-right">Uploading... {uploadProgress}%</p>
                </div>
              )}

              {/* Media Thumbnails */}
              {mediaList.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 mt-3">
                  {mediaList.map((item, idx) => {
                    const isVid = item.mime_type.startsWith('video/');
                    return (
                      <div
                        key={idx}
                        className="relative group rounded-lg overflow-hidden border border-stone-200 bg-stone-100 aspect-square"
                      >
                        {isVid ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800 text-white">
                            <Video className="w-6 h-6 text-stone-300" />
                            <span className="text-[10px] mt-1 font-mono uppercase">Video</span>
                          </div>
                        ) : (
                          <img
                            src={item.fullUrl || item.url}
                            alt="Media item"
                            className="w-full h-full object-cover"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(idx)}
                          className="absolute top-1 right-1 p-1 bg-stone-900/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Remove media"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Platform Validation Messages */}
            <div className="space-y-2">
              {hasInstagram && !igValidation.isValid && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Instagram Publishing Requirement:</span>
                    <p className="mt-0.5">{igValidation.errors[0]}</p>
                  </div>
                </div>
              )}

              {hasInstagram && igValidation.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>{igValidation.warnings[0]}</p>
                </div>
              )}
            </div>

            {/* Scheduling Controls */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-stone-800 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-stone-500" />
                <span>Scheduling Settings</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-500 mb-1">Timezone</label>
                  <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-stone-300 text-xs text-stone-700">
                    <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="truncate">{timezone}</span>
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {/* Right Column: Platform Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Platform Feed Preview
              </label>

              <div className="flex items-center rounded-lg border border-stone-200 bg-stone-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewPlatform('facebook')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    previewPlatform === 'facebook'
                      ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                      : 'text-stone-600'
                  }`}
                >
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPlatform('instagram')}
                  className={`px-2.5 py-1 rounded font-medium transition-all ${
                    previewPlatform === 'instagram'
                      ? 'bg-white text-rose-700 shadow-2xs font-semibold'
                      : 'text-stone-600'
                  }`}
                >
                  Instagram
                </button>
              </div>
            </div>

            {/* Preview Card */}
            <div className="flex-1 bg-stone-100 rounded-xl p-4 flex items-center justify-center border border-stone-200">
              {previewPlatform === 'facebook' ? (
                /* Facebook Preview */
                <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-stone-200 text-stone-900 text-xs">
                  {/* Header */}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        FB
                      </div>
                      <div>
                        <div className="font-semibold text-stone-900 flex items-center gap-1">
                          <span>Official Page</span>
                          <CheckCircle className="w-3 h-3 text-blue-600" />
                        </div>
                        <div className="text-[10px] text-stone-500">Just now · 🌍 Public</div>
                      </div>
                    </div>
                    <MoreHorizontal className="w-4 h-4 text-stone-400" />
                  </div>

                  {/* Caption */}
                  <div className="px-3 pb-2 text-stone-800 text-xs whitespace-pre-wrap">
                    {caption || <span className="text-stone-400 italic">Your caption will appear here...</span>}
                  </div>

                  {/* Media */}
                  {mediaList.length > 0 && (
                    <div className="bg-stone-900 max-h-64 overflow-hidden flex items-center justify-center">
                      {mediaList[0].mime_type.startsWith('video/') ? (
                        <div className="p-8 text-center text-white">
                          <Video className="w-8 h-8 mx-auto mb-1 text-stone-300" />
                          <span className="text-[11px]">Video Player Preview</span>
                        </div>
                      ) : (
                        <img
                          src={mediaList[0].fullUrl || mediaList[0].url}
                          alt="Facebook post preview"
                          className="w-full object-cover max-h-64"
                        />
                      )}
                    </div>
                  )}

                  {/* Facebook Engagement */}
                  <div className="px-3 py-2 border-t border-stone-100 flex items-center justify-around text-stone-500 font-medium text-[11px]">
                    <span>Like</span>
                    <span>Comment</span>
                    <span>Share</span>
                  </div>
                </div>
              ) : (
                /* Instagram Preview */
                <div className="w-full max-w-xs bg-white rounded-2xl shadow-sm border border-stone-200 text-stone-900 text-xs overflow-hidden">
                  {/* Header */}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-0.5">
                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-[10px] font-bold">
                          IG
                        </div>
                      </div>
                      <span className="font-semibold text-stone-900 text-xs">your_brand</span>
                    </div>
                    <MoreHorizontal className="w-4 h-4 text-stone-400" />
                  </div>

                  {/* Media (Instagram ALWAYS requires media) */}
                  <div className="bg-stone-950 aspect-square flex items-center justify-center overflow-hidden">
                    {mediaList.length > 0 ? (
                      mediaList[0].mime_type.startsWith('video/') ? (
                        <div className="text-center text-white">
                          <Video className="w-8 h-8 mx-auto mb-1 text-stone-300" />
                          <span className="text-[10px]">Reels/Video Preview</span>
                        </div>
                      ) : (
                        <img
                          src={mediaList[0].fullUrl || mediaList[0].url}
                          alt="Instagram post preview"
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="p-6 text-center text-stone-500 space-y-1">
                        <ImageIcon className="w-6 h-6 mx-auto text-stone-600" />
                        <p className="text-[11px] text-rose-400 font-medium">Image or Video Required</p>
                        <p className="text-[10px] text-stone-400">Instagram does not support text-only posts</p>
                      </div>
                    )}
                  </div>

                  {/* Action Icons */}
                  <div className="p-3 pb-1 flex items-center justify-between text-stone-800">
                    <div className="flex items-center gap-3">
                      <Heart className="w-4 h-4" />
                      <MessageCircle className="w-4 h-4" />
                      <Share className="w-4 h-4" />
                    </div>
                    <Bookmark className="w-4 h-4" />
                  </div>

                  {/* Caption */}
                  <div className="px-3 pb-3 text-[11px] text-stone-800 space-x-1 line-clamp-3">
                    <span className="font-semibold">your_brand</span>
                    <span>{caption || 'Add a caption...'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-lg text-xs font-medium transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave('draft')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave('publish_now')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Publish Now
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave('schedule')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5" />
              {submitting ? 'Saving...' : initialPost ? 'Update & Schedule' : 'Schedule Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
