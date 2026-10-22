import fs from 'fs';
import path from 'path';
import { config } from './config.ts';

export interface MetaPublishResult {
  success: boolean;
  externalPostId?: string;
  externalPostUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  requestSummary: string;
  responseSummary: string;
}

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  category?: string;
  tasks?: string[];
  instagramBusinessAccount?: {
    id: string;
    username?: string;
    name?: string;
    profilePictureUrl?: string;
  };
}

export interface TokenDebugInfo {
  isValid: boolean;
  appId: string;
  type: string;
  application: string;
  dataAccessExpiresAt?: number;
  expiresAt?: number;
  scopes?: string[];
  userId?: string;
  error?: string;
}

export class MetaService {
  private apiVersion: string;

  constructor() {
    this.apiVersion = config.meta.apiVersion;
  }

  getAuthorizationUrl(state: string): string {
    if (!config.meta.isConfigured) {
      throw new Error(
        'Meta API credentials (META_APP_ID, META_APP_SECRET) are not configured in environment variables. See documentation or System Settings.'
      );
    }

    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'business_management',
      'instagram_basic',
      'instagram_content_publish',
    ].join(',');

    const params = new URLSearchParams({
      client_id: config.meta.appId,
      redirect_uri: config.meta.redirectUri,
      state: state,
      scope: scopes,
      response_type: 'code',
    });

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    if (!config.meta.isConfigured) {
      throw new Error('Meta API credentials are not configured');
    }

    const tokenUrl = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.redirectUri,
      code: code,
    });

    const response = await fetch(`${tokenUrl}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      const err = data.error || {};
      throw new Error(`Meta OAuth Exchange Failed [${err.code || response.status}]: ${err.message || 'Unknown error'}`);
    }

    const shortLivedToken = data.access_token;

    // Exchange for long-lived user token (60 days)
    const longLivedUrl = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token`;
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const longResponse = await fetch(`${longLivedUrl}?${longLivedParams.toString()}`);
    const longData = await longResponse.json();

    if (longResponse.ok && longData.access_token) {
      return longData.access_token;
    }

    return shortLivedToken;
  }

  async debugToken(token: string): Promise<TokenDebugInfo> {
    if (!config.meta.isConfigured) {
      return {
        isValid: false,
        appId: '',
        type: 'unknown',
        application: '',
        error: 'Meta credentials not configured in server environment',
      };
    }

    const appAccessToken = `${config.meta.appId}|${config.meta.appSecret}`;
    const url = `https://graph.facebook.com/${this.apiVersion}/debug_token?input_token=${encodeURIComponent(
      token
    )}&access_token=${encodeURIComponent(appAccessToken)}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || json.error) {
        // Fallback: check if token is directly valid via /me
        try {
          const meRes = await fetch(
            `https://graph.facebook.com/${this.apiVersion}/me?fields=id,name&access_token=${encodeURIComponent(token)}`
          );
          const meJson = await meRes.json();
          if (meRes.ok && meJson.id) {
            return {
              isValid: true,
              appId: config.meta.appId,
              type: 'PAGE_OR_USER',
              application: meJson.name || 'Facebook Account',
              userId: meJson.id,
            };
          }
        } catch {}

        return {
          isValid: false,
          appId: config.meta.appId,
          type: 'unknown',
          application: '',
          error: json.error?.message || 'Token debug check failed',
        };
      }

      const d = json.data;
      return {
        isValid: Boolean(d.is_valid),
        appId: d.app_id,
        type: d.type,
        application: d.application,
        dataAccessExpiresAt: d.data_access_expires_at,
        expiresAt: d.expires_at,
        scopes: d.scopes || [],
        userId: d.user_id,
      };
    } catch (err: any) {
      return {
        isValid: false,
        appId: config.meta.appId,
        type: 'unknown',
        application: '',
        error: err.message || 'Failed to connect to Meta Graph API',
      };
    }
  }

  async fetchUserPages(userAccessToken: string): Promise<MetaPage[]> {
    const fields = 'id,name,access_token,category,tasks,instagram_business_account{id,username,name,profile_picture_url}';
    const url = `https://graph.facebook.com/${this.apiVersion}/me/accounts?fields=${fields}&access_token=${encodeURIComponent(
      userAccessToken
    )}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      const err = data.error || {};
      throw new Error(`Failed to retrieve Facebook Pages [${err.code || response.status}]: ${err.message || 'Unknown error'}`);
    }

    const rawPages = data.data || [];
    return rawPages.map((p: any) => ({
      id: p.id,
      name: p.name,
      accessToken: p.access_token,
      category: p.category,
      tasks: p.tasks || [],
      instagramBusinessAccount: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id,
            username: p.instagram_business_account.username,
            name: p.instagram_business_account.name,
            profilePictureUrl: p.instagram_business_account.profile_picture_url,
          }
        : undefined,
    }));
  }

  async fetchInstagramAccountDetails(igUserId: string, accessToken: string) {
    const fields = 'id,username,name,profile_picture_url';
    const url = `https://graph.facebook.com/${this.apiVersion}/${igUserId}?fields=${fields}&access_token=${encodeURIComponent(
      accessToken
    )}`;

    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || data.error) {
      const err = data.error || {};
      throw new Error(`Failed to retrieve Instagram account details [${err.code || response.status}]: ${err.message}`);
    }
    return data;
  }

  // Publish to Facebook Page
  async publishToFacebookPage(
    pageId: string,
    pageAccessToken: string,
    payload: {
      caption: string;
      mediaUrls?: Array<{ url: string; mime_type: string }>;
    }
  ): Promise<MetaPublishResult> {
    if (!config.meta.isConfigured) {
      return {
        success: false,
        errorCode: 'META_CONFIG_MISSING',
        errorMessage: 'Meta App ID and Secret are not configured in environment variables. Real publishing requires Meta API setup.',
        requestSummary: `POST /${pageId}/feed | Length: ${payload.caption?.length || 0}`,
        responseSummary: 'Blocked: Server missing META_APP_ID / META_APP_SECRET credentials.',
      };
    }

    const mediaList = payload.mediaUrls || [];
    const firstMedia = mediaList[0];
    const isVideo = firstMedia && firstMedia.mime_type.startsWith('video/');
    const isPhoto = firstMedia && firstMedia.mime_type.startsWith('image/');

    let endpoint: string;
    let body: any;
    let isFormData = false;

    if (isPhoto) {
      endpoint = `https://graph.facebook.com/${this.apiVersion}/${pageId}/photos`;
      const filename = path.basename(firstMedia.url);
      const localFilePath = path.resolve(config.storage.uploadDir, filename);

      if (fs.existsSync(localFilePath)) {
        const fileBuffer = fs.readFileSync(localFilePath);
        const mime = firstMedia.mime_type || 'image/jpeg';
        const blob = new Blob([fileBuffer], { type: mime });
        const formData = new FormData();
        formData.append('access_token', pageAccessToken);
        formData.append('caption', payload.caption || '');
        formData.append('source', blob, filename);
        body = formData;
        isFormData = true;
      } else {
        const fullUrl = this.resolveMediaUrl(firstMedia.url);
        body = {
          url: fullUrl,
          caption: payload.caption || '',
          access_token: pageAccessToken,
        };
      }
    } else if (isVideo) {
      endpoint = `https://graph.facebook.com/${this.apiVersion}/${pageId}/videos`;
      const fullUrl = this.resolveMediaUrl(firstMedia.url);
      body = {
        file_url: fullUrl,
        description: payload.caption || '',
        access_token: pageAccessToken,
      };
    } else {
      // Standard text/link post
      endpoint = `https://graph.facebook.com/${this.apiVersion}/${pageId}/feed`;
      body = {
        message: payload.caption || '',
        access_token: pageAccessToken,
      };
    }

    const requestSummary = `POST ${endpoint.replace(/access_token=[^&]+/, 'access_token=REDACTED')} [Media: ${isPhoto ? 'Photo' : isVideo ? 'Video' : 'Text'}]`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
        body: isFormData ? body : JSON.stringify(body),
      });

      const json = await res.json();
      const sanitizedResponse = JSON.stringify(json).replace(/"access_token":"[^"]+"/g, '"access_token":"REDACTED"');

      if (!res.ok || json.error) {
        const err = json.error || {};
        return {
          success: false,
          errorCode: `FB_ERR_${err.code || res.status}`,
          errorMessage: this.mapMetaErrorMessage(err),
          requestSummary,
          responseSummary: sanitizedResponse,
        };
      }

      const externalId = json.post_id || json.id;
      const externalUrl = externalId ? `https://www.facebook.com/${externalId}` : undefined;

      return {
        success: true,
        externalPostId: externalId,
        externalPostUrl: externalUrl,
        requestSummary,
        responseSummary: sanitizedResponse,
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'NETWORK_TIMEOUT',
        errorMessage: err.message || 'Network error while contacting Meta Graph API',
        requestSummary,
        responseSummary: `Error: ${err.message}`,
      };
    }
  }

  // Publish to Instagram Professional Account
  async publishToInstagram(
    igUserId: string,
    accessToken: string,
    payload: {
      caption: string;
      mediaUrls?: Array<{ url: string; mime_type: string }>;
    }
  ): Promise<MetaPublishResult> {
    if (!config.meta.isConfigured) {
      return {
        success: false,
        errorCode: 'META_CONFIG_MISSING',
        errorMessage: 'Meta App ID and Secret are not configured in environment variables. Real publishing requires Meta API setup.',
        requestSummary: `POST /${igUserId}/media | Length: ${payload.caption?.length || 0}`,
        responseSummary: 'Blocked: Server missing META_APP_ID / META_APP_SECRET credentials.',
      };
    }

    const mediaList = payload.mediaUrls || [];
    if (mediaList.length === 0) {
      return {
        success: false,
        errorCode: 'IG_MEDIA_REQUIRED',
        errorMessage: 'Instagram Graph API strictly requires at least one image or video. Pure text posts are not supported by Instagram.',
        requestSummary: `POST /${igUserId}/media [No Media]`,
        responseSummary: 'Client validation failed: Media missing.',
      };
    }

    const firstMedia = mediaList[0];
    const isVideo = firstMedia.mime_type.startsWith('video/');
    const fullMediaUrl = this.resolveMediaUrl(firstMedia.url);

    // Step 1: Create Container
    const containerEndpoint = `https://graph.facebook.com/${this.apiVersion}/${igUserId}/media`;
    const containerParams: any = {
      caption: payload.caption || '',
      access_token: accessToken,
    };

    if (isVideo) {
      containerParams.media_type = 'VIDEO'; // Or 'REELS'
      containerParams.video_url = fullMediaUrl;
    } else {
      containerParams.image_url = fullMediaUrl;
    }

    const reqSummary = `Step 1: POST /${igUserId}/media (${isVideo ? 'VIDEO' : 'IMAGE'})`;

    try {
      const containerRes = await fetch(containerEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerParams),
      });

      const containerJson = await containerRes.json();
      if (!containerRes.ok || containerJson.error) {
        const err = containerJson.error || {};
        return {
          success: false,
          errorCode: `IG_CONTAINER_ERR_${err.code || containerRes.status}`,
          errorMessage: this.mapMetaErrorMessage(err),
          requestSummary: reqSummary,
          responseSummary: JSON.stringify(containerJson),
        };
      }

      const creationId = containerJson.id;

      // Step 2: Poll container status if video
      if (isVideo) {
        const statusOk = await this.waitForContainerProcessing(creationId, accessToken);
        if (!statusOk.success) {
          return {
            success: false,
            errorCode: statusOk.errorCode || 'IG_PROCESSING_FAILED',
            errorMessage: statusOk.errorMessage || 'Instagram video container processing timed out or failed.',
            requestSummary: `${reqSummary} -> Step 2: Poll status (${creationId})`,
            responseSummary: statusOk.responseSummary || '',
          };
        }
      }

      // Step 3: Publish container
      const publishEndpoint = `https://graph.facebook.com/${this.apiVersion}/${igUserId}/media_publish`;
      const publishRes = await fetch(publishEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
      });

      const publishJson = await publishRes.json();
      if (!publishRes.ok || publishJson.error) {
        const err = publishJson.error || {};
        return {
          success: false,
          errorCode: `IG_PUBLISH_ERR_${err.code || publishRes.status}`,
          errorMessage: this.mapMetaErrorMessage(err),
          requestSummary: `${reqSummary} -> Step 3: POST /${igUserId}/media_publish`,
          responseSummary: JSON.stringify(publishJson),
        };
      }

      const mediaId = publishJson.id;

      // Optional: Retrieve permalink
      let permalink: string | undefined;
      try {
        const pRes = await fetch(
          `https://graph.facebook.com/${this.apiVersion}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(
            accessToken
          )}`
        );
        const pJson = await pRes.json();
        permalink = pJson.permalink;
      } catch {
        // Permalink retrieval is non-blocking
      }

      return {
        success: true,
        externalPostId: mediaId,
        externalPostUrl: permalink || `https://www.instagram.com/p/${mediaId}`,
        requestSummary: `${reqSummary} -> Step 3: Published ID ${mediaId}`,
        responseSummary: JSON.stringify(publishJson),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'IG_NETWORK_ERROR',
        errorMessage: err.message || 'Error communicating with Instagram Graph API',
        requestSummary: reqSummary,
        responseSummary: `Error: ${err.message}`,
      };
    }
  }

  private async waitForContainerProcessing(
    creationId: string,
    accessToken: string,
    maxWaitSec: number = 30
  ): Promise<{ success: boolean; errorCode?: string; errorMessage?: string; responseSummary?: string }> {
    const startTime = Date.now();
    let pollInterval = 2000;

    while (Date.now() - startTime < maxWaitSec * 1000) {
      await new Promise((res) => setTimeout(res, pollInterval));

      const statusUrl = `https://graph.facebook.com/${this.apiVersion}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(
        accessToken
      )}`;

      try {
        const res = await fetch(statusUrl);
        const json = await res.json();
        const code = json.status_code;

        if (code === 'FINISHED') {
          return { success: true };
        }
        if (code === 'ERROR' || code === 'EXPIRED') {
          return {
            success: false,
            errorCode: `IG_STATUS_${code}`,
            errorMessage: json.status || `Instagram container failed with status ${code}`,
            responseSummary: JSON.stringify(json),
          };
        }
      } catch (err: any) {
        // transient poll error, continue
      }

      pollInterval = Math.min(pollInterval * 1.5, 6000);
    }

    return {
      success: false,
      errorCode: 'IG_TIMEOUT',
      errorMessage: 'Instagram video container processing timed out before publishing.',
    };
  }

  private resolveMediaUrl(relativeOrAbsoluteUrl: string): string {
    if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
      return relativeOrAbsoluteUrl;
    }
    return `${config.appUrl}${relativeOrAbsoluteUrl.startsWith('/') ? '' : '/'}${relativeOrAbsoluteUrl}`;
  }

  private mapMetaErrorMessage(err: any): string {
    const code = err.code;
    const subcode = err.error_subcode;
    const msg = err.message || 'Meta API returned an error';

    if (code === 190) {
      return `Access token is invalid, expired, or revoked (Meta Code 190). Please reconnect your account. Details: ${msg}`;
    }
    if (code === 200) {
      return `Missing required permissions (Meta Code 200). Ensure pages_manage_posts or instagram_content_publish was granted. Details: ${msg}`;
    }
    if (code === 368) {
      return `Action temporarily blocked by Facebook security/spam filters (Meta Code 368). Please wait before publishing. Details: ${msg}`;
    }
    if (code === 100) {
      return `Invalid parameters or unsupported media specifications (Meta Code 100, subcode ${subcode || 'none'}): ${msg}`;
    }
    if (code === 9004) {
      return `Media upload failed or video formatting is incompatible: ${msg}`;
    }

    return `[Meta Code ${code || 'Unknown'}]: ${msg}`;
  }
}

export const metaService = new MetaService();
