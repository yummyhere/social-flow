export interface MediaItem {
  url: string;
  filename?: string;
  mime_type: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  duration_sec?: number;
}

export interface PlatformValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const PLATFORM_LIMITS = {
  facebook: {
    maxCaptionLength: 63206,
    supportsTextOnly: true,
    maxMediaCount: 10,
    supportedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'],
  },
  instagram: {
    maxCaptionLength: 2200,
    maxHashtags: 30,
    supportsTextOnly: false, // Instagram Graph API requires media
    maxMediaCount: 10,
    supportedMimes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
    photoAspectRatios: { min: 0.8, max: 1.91 }, // 4:5 to 1.91:1
    videoAspectRatios: { min: 0.5625, max: 1.7778 }, // 9:16 to 16:9
  },
};

export function validateFacebookPost(caption: string, media: MediaItem[] = []): PlatformValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (caption && caption.length > PLATFORM_LIMITS.facebook.maxCaptionLength) {
    errors.push(`Facebook caption exceeds maximum length (${caption.length}/${PLATFORM_LIMITS.facebook.maxCaptionLength} characters).`);
  }

  if (media.length > PLATFORM_LIMITS.facebook.maxMediaCount) {
    errors.push(`Facebook allows up to ${PLATFORM_LIMITS.facebook.maxMediaCount} media items.`);
  }

  for (const m of media) {
    if (!PLATFORM_LIMITS.facebook.supportedMimes.includes(m.mime_type)) {
      errors.push(`Unsupported file format for Facebook: ${m.mime_type}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateInstagramPost(caption: string, media: MediaItem[] = []): PlatformValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Instagram Graph API strictly requires media
  if (!media || media.length === 0) {
    errors.push('Instagram Content Publishing requires at least one photo or video. Text-only posts are unsupported.');
  }

  if (caption && caption.length > PLATFORM_LIMITS.instagram.maxCaptionLength) {
    errors.push(`Instagram caption exceeds maximum length (${caption.length}/${PLATFORM_LIMITS.instagram.maxCaptionLength} characters).`);
  }

  // Count hashtags
  if (caption) {
    const hashtagMatches = caption.match(/#[a-zA-Z0-9_]+/g);
    const hashtagCount = hashtagMatches ? hashtagMatches.length : 0;
    if (hashtagCount > PLATFORM_LIMITS.instagram.maxHashtags) {
      errors.push(`Instagram allows a maximum of 30 hashtags (found ${hashtagCount}).`);
    }
  }

  if (media.length > PLATFORM_LIMITS.instagram.maxMediaCount) {
    errors.push(`Instagram carousel supports up to ${PLATFORM_LIMITS.instagram.maxMediaCount} items.`);
  }

  for (const m of media) {
    if (!PLATFORM_LIMITS.instagram.supportedMimes.includes(m.mime_type)) {
      errors.push(`Instagram unsupported media format: ${m.mime_type}. Allowed: JPEG, PNG, MP4, MOV.`);
    }

    if (m.width && m.height) {
      const ratio = m.width / m.height;
      const isVideo = m.mime_type.startsWith('video/');
      const limits = isVideo ? PLATFORM_LIMITS.instagram.videoAspectRatios : PLATFORM_LIMITS.instagram.photoAspectRatios;

      if (ratio < limits.min - 0.05 || ratio > limits.max + 0.05) {
        warnings.push(
          `Media aspect ratio (${ratio.toFixed(2)}) is outside Instagram recommended range (${limits.min.toFixed(2)} to ${limits.max.toFixed(2)}). It may be cropped.`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function derivePostStatusFromTargets(
  targets: Array<{ target_status: string }>
): 'published' | 'partially_published' | 'failed' | 'publishing' | 'scheduled' {
  if (targets.length === 0) return 'scheduled';
  
  const allPublished = targets.every((t) => t.target_status === 'published');
  if (allPublished) return 'published';

  const anyPublished = targets.some((t) => t.target_status === 'published');
  const allFailed = targets.every((t) => t.target_status === 'failed');

  if (allFailed) return 'failed';
  if (anyPublished) return 'partially_published';

  const anyPublishing = targets.some((t) => t.target_status === 'publishing');
  if (anyPublishing) return 'publishing';

  return 'scheduled';
}

export function calculateRetryBackoffSec(attemptNumber: number): number {
  // Bounded exponential backoff: 30s, 60s, 120s, max 300s
  return Math.min(30 * Math.pow(2, Math.max(0, attemptNumber - 1)), 300);
}
