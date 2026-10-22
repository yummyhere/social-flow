export interface User {
  id: string;
  email: string;
  full_name: string;
  timezone: string;
}

export interface SocialAccount {
  id: string;
  platform: 'facebook' | 'instagram';
  platform_account_id: string;
  display_name: string;
  account_type: 'facebook_page' | 'instagram_business' | 'instagram_creator';
  connection_status: 'active' | 'expired' | 'revoked' | 'error';
  last_connection_check: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  url: string;
  fullUrl?: string;
  filename?: string;
  originalName?: string;
  mime_type: string;
  size_bytes?: number;
  width?: number;
  height?: number;
}

export interface PostTarget {
  id: string;
  post_id: string;
  social_account_id: string;
  platform: 'facebook' | 'instagram';
  target_status: 'pending' | 'publishing' | 'published' | 'failed' | 'cancelled';
  external_post_id?: string | null;
  external_post_url?: string | null;
  attempt_count: number;
  last_error_code?: string | null;
  last_error_message?: string | null;
  published_at?: string | null;
  display_name?: string;
  account_type?: string;
  avatar_url?: string | null;
}

export interface PublishingAttempt {
  id: string;
  target_id: string;
  post_id: string;
  attempt_number: number;
  started_at: string;
  completed_at: string;
  result: 'success' | 'failed';
  error_code?: string | null;
  error_message?: string | null;
  api_request_summary: string;
  api_response_summary: string;
  platform?: string;
  display_name?: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  caption: string;
  media_urls: MediaItem[];
  timezone: string;
  scheduled_at_utc: string | null;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'partially_published' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  target_count?: number;
  target_platforms?: string;
  targets?: PostTarget[];
  attempts?: PublishingAttempt[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  caption: string;
  date: string;
  status: SocialPost['status'];
  timezone: string;
  mediaCount: number;
  thumbnail: string | null;
  targets: PostTarget[];
  platforms: string[];
}

export interface WorkspaceMetrics {
  scheduled: number;
  published: number;
  drafts: number;
  failed: number;
  total: number;
}

export interface SystemStatus {
  serverTimeUtc: string;
  environment: string;
  appUrl: string;
  meta: {
    isConfigured: boolean;
    appIdMasked: string;
    apiVersion: string;
    redirectUri: string;
  };
  scheduler: {
    workerId: string;
    isPolling: boolean;
    lastTickAt: string | null;
    runningJobsCount: number;
    totalProcessedCount: number;
    consecutiveErrors: number;
  };
  database: {
    status: string;
    stats: {
      users: number;
      connectedAccounts: number;
      posts: number;
      publishingAttempts: number;
    };
  };
  metaSetupInstructions: {
    title: string;
    steps: string[];
  };
}
