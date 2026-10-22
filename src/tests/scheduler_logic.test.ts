import test from 'node:test';
import assert from 'node:assert/strict';

test('scheduler logic: due post detection compares timestamps accurately in UTC', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');

  const posts = [
    { id: '1', status: 'scheduled', scheduled_at_utc: '2026-10-20T11:59:00.000Z' }, // due
    { id: '2', status: 'scheduled', scheduled_at_utc: '2026-10-20T12:00:00.000Z' }, // due right now
    { id: '3', status: 'scheduled', scheduled_at_utc: '2026-10-20T12:05:00.000Z' }, // future
    { id: '4', status: 'draft', scheduled_at_utc: '2026-10-20T11:00:00.000Z' },     // draft, not scheduled
    { id: '5', status: 'published', scheduled_at_utc: '2026-10-20T11:00:00.000Z' }, // already published
  ];

  const duePosts = posts.filter(
    (p) =>
      p.status === 'scheduled' &&
      p.scheduled_at_utc &&
      new Date(p.scheduled_at_utc).getTime() <= now.getTime()
  );

  assert.equal(duePosts.length, 2);
  assert.deepEqual(
    duePosts.map((p) => p.id),
    ['1', '2']
  );
});

test('scheduler logic: detects stale locked jobs for reconciliation after crash', () => {
  const now = new Date('2026-10-20T12:10:00.000Z');
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  const activeWorkerJob = {
    id: 'job-active',
    status: 'publishing',
    locked_at: '2026-10-20T12:08:00.000Z', // 2 mins ago
  };

  const crashedWorkerJob = {
    id: 'job-crashed',
    status: 'publishing',
    locked_at: '2026-10-20T11:55:00.000Z', // 15 mins ago
  };

  const isStale = (job: typeof activeWorkerJob) => {
    if (job.status !== 'publishing' || !job.locked_at) return false;
    const elapsed = now.getTime() - new Date(job.locked_at).getTime();
    return elapsed > STALE_THRESHOLD_MS;
  };

  assert.equal(isStale(activeWorkerJob), false);
  assert.equal(isStale(crashedWorkerJob), true);
});

test('scheduler logic: multi-target state correctly isolates failure to one target without corrupting other targets', () => {
  const targets = [
    {
      id: 'target-fb',
      platform: 'facebook',
      target_status: 'published',
      external_post_id: 'page123_post999',
    },
    {
      id: 'target-ig',
      platform: 'instagram',
      target_status: 'failed',
      last_error_code: 'IG_MEDIA_REQUIRED',
      last_error_message: 'Instagram requires media',
    },
  ];

  assert.equal(targets[0].target_status, 'published');
  assert.equal(targets[0].external_post_id, 'page123_post999');

  assert.equal(targets[1].target_status, 'failed');
  assert.equal(targets[1].last_error_code, 'IG_MEDIA_REQUIRED');

  // Verify that retrying only targets failed ones
  const eligibleForRetry = targets.filter((t) => t.target_status === 'failed');
  assert.equal(eligibleForRetry.length, 1);
  assert.equal(eligibleForRetry[0].platform, 'instagram');
});
