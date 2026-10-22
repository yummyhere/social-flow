import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFacebookPost,
  validateInstagramPost,
  derivePostStatusFromTargets,
  calculateRetryBackoffSec,
} from '../utils/validation.ts';
import type { MediaItem } from '../utils/validation.ts';

test('validation: Facebook allows valid text-only and media posts', () => {
  const textOnlyResult = validateFacebookPost('Exciting company update: SocialFlow launch!');
  assert.equal(textOnlyResult.isValid, true);
  assert.equal(textOnlyResult.errors.length, 0);

  const photoMedia: MediaItem[] = [
    { url: '/uploads/demo.jpg', mime_type: 'image/jpeg', size_bytes: 500000 },
  ];
  const photoResult = validateFacebookPost('Post with photo', photoMedia);
  assert.equal(photoResult.isValid, true);
  assert.equal(photoResult.errors.length, 0);
});

test('validation: Facebook rejects caption exceeding 63,206 characters or unsupported MIME', () => {
  const longCaption = 'A'.repeat(63207);
  const result = validateFacebookPost(longCaption);
  assert.equal(result.isValid, false);
  assert.match(result.errors[0], /Facebook caption exceeds maximum length/);

  const unsupportedMedia: MediaItem[] = [
    { url: '/uploads/doc.pdf', mime_type: 'application/pdf' },
  ];
  const mimeResult = validateFacebookPost('Caption', unsupportedMedia);
  assert.equal(mimeResult.isValid, false);
  assert.match(mimeResult.errors[0], /Unsupported file format/);
});

test('validation: Instagram strictly rejects text-only posts without media', () => {
  const result = validateInstagramPost('Hello Instagram without any image!');
  assert.equal(result.isValid, false);
  assert.ok(result.errors.some((e) => e.includes('Instagram Content Publishing requires at least one photo or video')));
});

test('validation: Instagram enforces 2,200 character and 30 hashtag limits', () => {
  const validMedia: MediaItem[] = [
    { url: '/uploads/pic.jpg', mime_type: 'image/jpeg' },
  ];

  // 31 hashtags
  const tooManyHashtags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ');
  const tagResult = validateInstagramPost(tooManyHashtags, validMedia);
  assert.equal(tagResult.isValid, false);
  assert.match(tagResult.errors[0], /maximum of 30 hashtags/);

  // Over 2,200 chars
  const longCaption = 'X'.repeat(2201);
  const lengthResult = validateInstagramPost(longCaption, validMedia);
  assert.equal(lengthResult.isValid, false);
  assert.match(lengthResult.errors[0], /Instagram caption exceeds maximum length/);
});

test('validation: Instagram warns on extreme aspect ratios', () => {
  // Extreme aspect ratio (width: 100, height: 1000 => 0.1 ratio, far below 0.8)
  const extremeMedia: MediaItem[] = [
    { url: '/uploads/banner.jpg', mime_type: 'image/jpeg', width: 100, height: 1000 },
  ];
  const result = validateInstagramPost('Caption', extremeMedia);
  assert.equal(result.isValid, true); // It is valid to submit, but with warning
  assert.ok(result.warnings.some((w) => w.includes('recommended range')));
});

test('status derivation: correctly determines overall post status from target states', () => {
  // All published
  assert.equal(
    derivePostStatusFromTargets([{ target_status: 'published' }, { target_status: 'published' }]),
    'published'
  );

  // Partial success (Facebook succeeded, Instagram failed)
  assert.equal(
    derivePostStatusFromTargets([{ target_status: 'published' }, { target_status: 'failed' }]),
    'partially_published'
  );

  // All failed
  assert.equal(
    derivePostStatusFromTargets([{ target_status: 'failed' }, { target_status: 'failed' }]),
    'failed'
  );

  // Still publishing
  assert.equal(
    derivePostStatusFromTargets([{ target_status: 'published' }, { target_status: 'publishing' }]),
    'partially_published' // has at least one published
  );

  assert.equal(
    derivePostStatusFromTargets([{ target_status: 'pending' }, { target_status: 'publishing' }]),
    'publishing'
  );
});

test('retry backoff: bounded exponential backoff correctly caps at 300 seconds', () => {
  assert.equal(calculateRetryBackoffSec(1), 30);
  assert.equal(calculateRetryBackoffSec(2), 60);
  assert.equal(calculateRetryBackoffSec(3), 120);
  assert.equal(calculateRetryBackoffSec(4), 240);
  assert.equal(calculateRetryBackoffSec(5), 300); // capped
  assert.equal(calculateRetryBackoffSec(10), 300); // capped
});
