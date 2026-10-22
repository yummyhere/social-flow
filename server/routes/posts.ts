import { Router, Response } from 'express';
import crypto from 'crypto';
import { query, get, run, transaction } from '../db.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { scheduler } from '../scheduler.ts';

const router = Router();

// 1. Create Post (Draft, Scheduled, or Publish Now)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      caption = '',
      media_urls = [],
      timezone = req.user!.timezone || 'UTC',
      scheduled_at_utc = null,
      status = 'draft',
      target_account_ids = [],
      publish_now = false,
    } = req.body;

    // Validate targets exist and belong to user
    const selectedAccounts: any[] = [];
    if (target_account_ids.length > 0) {
      for (const accId of target_account_ids) {
        const acc = get(`SELECT * FROM social_accounts WHERE id = ? AND user_id = ?`, [accId, userId]);
        if (!acc) {
          res.status(400).json({ error: `Selected social account ${accId} is invalid or not owned by you.` });
          return;
        }
        selectedAccounts.push(acc);
      }
    }

    // Platform validation checks
    const hasInstagram = selectedAccounts.some((a) => a.platform === 'instagram');
    const hasMedia = Array.isArray(media_urls) && media_urls.length > 0;

    if (hasInstagram && !hasMedia && (status === 'scheduled' || publish_now)) {
      res.status(400).json({
        error: 'Instagram requires at least one photo or video. Cannot schedule or publish text-only post to Instagram.',
      });
      return;
    }

    // Determine initial status & schedule timestamp
    let finalStatus = status;
    let finalScheduledAt = scheduled_at_utc;

    if (publish_now) {
      finalStatus = 'scheduled';
      finalScheduledAt = new Date().toISOString();
    } else if (finalStatus === 'scheduled') {
      if (!finalScheduledAt) {
        res.status(400).json({ error: 'A scheduled post requires scheduled_at_utc timestamp.' });
        return;
      }
      const scheduledDate = new Date(finalScheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'Invalid scheduled_at_utc timestamp format.' });
        return;
      }
      // Must not be in the past by more than 1 minute
      if (scheduledDate.getTime() < Date.now() - 60000) {
        res.status(400).json({ error: 'Scheduled time cannot be in the past. Use Publish Now instead.' });
        return;
      }
    }

    const postId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const mediaJson = JSON.stringify(media_urls);

    transaction(() => {
      run(
        `INSERT INTO social_posts 
         (id, user_id, caption, media_urls, timezone, scheduled_at_utc, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [postId, userId, caption, mediaJson, timezone, finalScheduledAt, finalStatus, nowIso, nowIso]
      );

      // Create post targets
      for (const acc of selectedAccounts) {
        const targetId = crypto.randomUUID();
        run(
          `INSERT INTO post_targets 
           (id, post_id, social_account_id, platform, target_status, attempt_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`,
          [targetId, postId, acc.id, acc.platform, nowIso, nowIso]
        );
      }
    });

    // If publish_now requested, immediately trigger scheduler process
    if (publish_now) {
      scheduler.processPost(postId).catch(console.error);
    }

    const post = getPostWithDetails(postId, userId);
    res.status(201).json({ post });
  } catch (err: any) {
    console.error('Create post error:', err);
    res.status(500).json({ error: err.message || 'Failed to create post' });
  }
});

// 2. List & Filter Posts
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { status, platform, search, limit = '50', offset = '0' } = req.query;

  let sql = `
    SELECT sp.*, 
      (SELECT COUNT(*) FROM post_targets WHERE post_id = sp.id) as target_count,
      (SELECT GROUP_CONCAT(platform) FROM post_targets WHERE post_id = sp.id) as target_platforms
    FROM social_posts sp 
    WHERE sp.user_id = ?
  `;
  const params: any[] = [userId];

  if (status && status !== 'all') {
    sql += ` AND sp.status = ?`;
    params.push(status);
  }

  if (search) {
    sql += ` AND sp.caption LIKE ?`;
    params.push(`%${search}%`);
  }

  sql += ` ORDER BY 
    CASE 
      WHEN sp.status = 'scheduled' THEN sp.scheduled_at_utc 
      ELSE sp.updated_at 
    END DESC 
    LIMIT ? OFFSET ?`;
  params.push(parseInt(String(limit), 10), parseInt(String(offset), 10));

  const posts = query<any>(sql, params).map((p) => {
    let media = [];
    try {
      media = JSON.parse(p.media_urls || '[]');
    } catch {}
    const targets = query<any>(
      `SELECT pt.*, sa.display_name, sa.account_type 
       FROM post_targets pt
       JOIN social_accounts sa ON pt.social_account_id = sa.id
       WHERE pt.post_id = ?`,
      [p.id]
    );

    return {
      ...p,
      media_urls: media,
      targets,
    };
  });

  // Calculate quick metrics for user workspace
  const metrics = get<any>(
    `SELECT 
       SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_count,
       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published_count,
       SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
       SUM(CASE WHEN status = 'failed' OR status = 'partially_published' THEN 1 ELSE 0 END) as failed_count,
       COUNT(*) as total_count
     FROM social_posts 
     WHERE user_id = ?`,
    [userId]
  );

  res.json({
    posts,
    metrics: {
      scheduled: metrics?.scheduled_count || 0,
      published: metrics?.published_count || 0,
      drafts: metrics?.draft_count || 0,
      failed: metrics?.failed_count || 0,
      total: metrics?.total_count || 0,
    },
  });
});

// 3. Get Single Post Details with Target Statuses and Publishing Attempts Audit Log
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id;

  const post = getPostWithDetails(postId, userId);
  if (!post) {
    res.status(404).json({ error: 'Post not found or unauthorized.' });
    return;
  }

  res.json({ post });
});

// 4. Update Post
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const postId = req.params.id;
    const {
      caption,
      media_urls,
      timezone,
      scheduled_at_utc,
      status,
      target_account_ids,
    } = req.body;

    const existing = get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    if (existing.status === 'publishing') {
      res.status(400).json({ error: 'Cannot edit a post that is currently being published.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const mediaJson = media_urls !== undefined ? JSON.stringify(media_urls) : existing.media_urls;

    transaction(() => {
      run(
        `UPDATE social_posts 
         SET caption = COALESCE(?, caption),
             media_urls = ?,
             timezone = COALESCE(?, timezone),
             scheduled_at_utc = ?,
             status = COALESCE(?, status),
             updated_at = ?
         WHERE id = ?`,
        [
          caption !== undefined ? caption : existing.caption,
          mediaJson,
          timezone || existing.timezone,
          scheduled_at_utc !== undefined ? scheduled_at_utc : existing.scheduled_at_utc,
          status || existing.status,
          nowIso,
          postId,
        ]
      );

      // If target_account_ids provided, sync targets
      if (Array.isArray(target_account_ids)) {
        run(`DELETE FROM post_targets WHERE post_id = ?`, [postId]);
        for (const accId of target_account_ids) {
          const acc = get<any>(`SELECT * FROM social_accounts WHERE id = ? AND user_id = ?`, [accId, userId]);
          if (acc) {
            run(
              `INSERT INTO post_targets (id, post_id, social_account_id, platform, target_status, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
              [crypto.randomUUID(), postId, acc.id, acc.platform, nowIso, nowIso]
            );
          }
        }
      }
    });

    const updated = getPostWithDetails(postId, userId);
    res.json({ post: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update post' });
  }
});

// 5. Trigger Immediate Publish Now
router.post('/:id/publish-now', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id;

  const existing = get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const nowIso = new Date().toISOString();
  run(
    `UPDATE social_posts 
     SET status = 'scheduled', scheduled_at_utc = ?, updated_at = ? 
     WHERE id = ?`,
    [nowIso, nowIso, postId]
  );

  // Trigger background worker
  scheduler.processPost(postId).catch(console.error);

  res.json({ message: 'Publishing initiated immediately.', post: getPostWithDetails(postId, userId) });
});

// 6. Reschedule Post
router.post('/:id/reschedule', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id;
  const { scheduled_at_utc } = req.body;

  if (!scheduled_at_utc) {
    res.status(400).json({ error: 'scheduled_at_utc is required for rescheduling.' });
    return;
  }

  const existing = get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const nowIso = new Date().toISOString();
  transaction(() => {
    run(
      `UPDATE social_posts 
       SET scheduled_at_utc = ?, status = 'scheduled', updated_at = ? 
       WHERE id = ?`,
      [scheduled_at_utc, nowIso, postId]
    );
    // Reset pending targets
    run(`UPDATE post_targets SET target_status = 'pending', updated_at = ? WHERE post_id = ? AND target_status != 'published'`, [
      nowIso,
      postId,
    ]);
  });

  res.json({ message: 'Post rescheduled successfully.', post: getPostWithDetails(postId, userId) });
});

// 7. Cancel Scheduled Post
router.post('/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id;

  const existing = get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const nowIso = new Date().toISOString();
  transaction(() => {
    run(`UPDATE social_posts SET status = 'cancelled', updated_at = ? WHERE id = ?`, [nowIso, postId]);
    run(`UPDATE post_targets SET target_status = 'cancelled', updated_at = ? WHERE post_id = ? AND target_status = 'pending'`, [
      nowIso,
      postId,
    ]);
  });

  res.json({ message: 'Post cancelled.', post: getPostWithDetails(postId, userId) });
});

// 8. Retry Failed Targets
router.post('/:id/retry-failed', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id;

  const existing = get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  const nowIso = new Date().toISOString();
  transaction(() => {
    run(
      `UPDATE post_targets 
       SET target_status = 'pending', updated_at = ? 
       WHERE post_id = ? AND target_status = 'failed'`,
      [nowIso, postId]
    );
    run(
      `UPDATE social_posts 
       SET status = 'scheduled', scheduled_at_utc = ?, updated_at = ? 
       WHERE id = ?`,
      [nowIso, nowIso, postId]
    );
  });

  // Run publishing
  scheduler.processPost(postId).catch(console.error);

  res.json({ message: 'Retrying failed targets.', post: getPostWithDetails(postId, userId) });
});

// 9. Delete Post
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const postId = req.params.id;

  const existing = get(`SELECT id FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  if (!existing) {
    res.status(404).json({ error: 'Post not found.' });
    return;
  }

  run(`DELETE FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  res.json({ message: 'Post deleted successfully.' });
});

function getPostWithDetails(postId: string, userId: string) {
  const post = get<any>(`SELECT * FROM social_posts WHERE id = ? AND user_id = ?`, [postId, userId]);
  if (!post) return null;

  let media = [];
  try {
    media = JSON.parse(post.media_urls || '[]');
  } catch {}

  const targets = query<any>(
    `SELECT pt.*, sa.display_name, sa.account_type, sa.platform_account_id, sa.avatar_url
     FROM post_targets pt
     JOIN social_accounts sa ON pt.social_account_id = sa.id
     WHERE pt.post_id = ?`,
    [postId]
  );

  const attempts = query<any>(
    `SELECT pa.*, pt.platform, sa.display_name
     FROM publishing_attempts pa
     JOIN post_targets pt ON pa.target_id = pt.id
     JOIN social_accounts sa ON pt.social_account_id = sa.id
     WHERE pa.post_id = ?
     ORDER BY pa.started_at DESC`,
    [postId]
  );

  return {
    ...post,
    media_urls: media,
    targets,
    attempts,
  };
}

export default router;
