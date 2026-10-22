import {
  User,
  SocialAccount,
  SocialPost,
  CalendarEvent,
  WorkspaceMetrics,
  SystemStatus,
  MediaItem,
} from '../types/index.ts';

const TOKEN_KEY = 'socialflow_token';

export const apiClient = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMessage = data.error || `Request failed with status ${res.status}`;
      throw new Error(errMessage);
    }

    return data as T;
  },

  // Auth
  async register(payload: { email: string; password: string; full_name: string; timezone?: string }) {
    return this.request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async login(payload: { email: string; password: string }) {
    return this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMe() {
    return this.request<{ user: User }>('/api/auth/me');
  },

  async updateProfile(payload: { full_name?: string; timezone?: string }) {
    return this.request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Social Accounts
  async getAccounts() {
    return this.request<{ accounts: SocialAccount[] }>('/api/social/accounts');
  },

  async initiateMetaConnect() {
    return this.request<{ authUrl: string; state: string }>('/api/social/connect/meta');
  },

  async connectDirectToken(payload: {
    token: string;
    platform: 'facebook' | 'instagram';
    displayName?: string;
    accountId?: string;
  }) {
    return this.request<{ message: string; account: SocialAccount }>('/api/social/connect-token', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyAccount(accountId: string) {
    return this.request<{ status: string; debug: any; lastCheck: string }>(
      `/api/social/accounts/${accountId}/verify`,
      { method: 'POST' }
    );
  },

  async disconnectAccount(accountId: string) {
    return this.request<{ message: string }>(`/api/social/accounts/${accountId}`, {
      method: 'DELETE',
    });
  },

  // Posts
  async getPosts(params: { status?: string; search?: string; limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    return this.request<{ posts: SocialPost[]; metrics: WorkspaceMetrics }>(`/api/posts?${query.toString()}`);
  },

  async getPost(postId: string) {
    return this.request<{ post: SocialPost }>(`/api/posts/${postId}`);
  },

  async createPost(payload: {
    caption: string;
    media_urls: MediaItem[];
    timezone?: string;
    scheduled_at_utc?: string | null;
    status: 'draft' | 'scheduled';
    target_account_ids: string[];
    publish_now?: boolean;
  }) {
    return this.request<{ post: SocialPost }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updatePost(
    postId: string,
    payload: {
      caption?: string;
      media_urls?: MediaItem[];
      timezone?: string;
      scheduled_at_utc?: string | null;
      status?: string;
      target_account_ids?: string[];
    }
  ) {
    return this.request<{ post: SocialPost }>(`/api/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async publishNow(postId: string) {
    return this.request<{ message: string; post: SocialPost }>(`/api/posts/${postId}/publish-now`, {
      method: 'POST',
    });
  },

  async reschedulePost(postId: string, scheduled_at_utc: string) {
    return this.request<{ message: string; post: SocialPost }>(`/api/posts/${postId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_at_utc }),
    });
  },

  async cancelPost(postId: string) {
    return this.request<{ message: string; post: SocialPost }>(`/api/posts/${postId}/cancel`, {
      method: 'POST',
    });
  },

  async retryFailedTargets(postId: string) {
    return this.request<{ message: string; post: SocialPost }>(`/api/posts/${postId}/retry-failed`, {
      method: 'POST',
    });
  },

  async deletePost(postId: string) {
    return this.request<{ message: string }>(`/api/posts/${postId}`, {
      method: 'DELETE',
    });
  },

  // Calendar
  async getCalendarEvents(params: { start?: string; end?: string; platform?: string; status?: string } = {}) {
    const query = new URLSearchParams();
    if (params.start) query.set('start', params.start);
    if (params.end) query.set('end', params.end);
    if (params.platform) query.set('platform', params.platform);
    if (params.status) query.set('status', params.status);

    return this.request<{ events: CalendarEvent[] }>(`/api/calendar?${query.toString()}`);
  },

  // Media
  async uploadMedia(file: File): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<MediaItem>('/api/media/upload', {
      method: 'POST',
      body: formData,
    });
  },

  // System
  async getSystemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>('/api/system/status');
  },
};
