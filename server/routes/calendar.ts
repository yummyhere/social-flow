import { Router, Response } from 'express';
import { query } from '../db.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { start, end, platform, status } = req.query;

  let sql = `
    SELECT sp.*, 
      (SELECT GROUP_CONCAT(platform) FROM post_targets WHERE post_id = sp.id) as platforms
    FROM social_posts sp
    WHERE sp.user_id = ?
  `;
  const params: any[] = [userId];

  if (start && end) {
    // Include scheduled posts in window, or published posts in window, or drafts created in window
    sql += ` AND (
      (sp.scheduled_at_utc >= ? AND sp.scheduled_at_utc <= ?) OR
      (sp.published_at >= ? AND sp.published_at <= ?) OR
      (sp.status = 'draft' AND sp.created_at >= ? AND sp.created_at <= ?)
    )`;
    params.push(String(start), String(end), String(start), String(end), String(start), String(end));
  }

  if (status && status !== 'all') {
    sql += ` AND sp.status = ?`;
    params.push(status);
  }

  const rows = query<any>(sql, params);

  // Filter by platform if specified
  const filtered = rows.filter((r) => {
    if (!platform || platform === 'all') return true;
    const plats = (r.platforms || '').split(',');
    return plats.includes(String(platform));
  });

  const events = filtered.map((p) => {
    let media = [];
    try {
      media = JSON.parse(p.media_urls || '[]');
    } catch {}

    const targets = query<any>(
      `SELECT pt.id, pt.platform, pt.target_status, pt.external_post_id, pt.external_post_url, sa.display_name 
       FROM post_targets pt
       JOIN social_accounts sa ON pt.social_account_id = sa.id
       WHERE pt.post_id = ?`,
      [p.id]
    );

    // Event date preference: scheduled_at_utc > published_at > created_at
    const eventDate = p.scheduled_at_utc || p.published_at || p.created_at;

    return {
      id: p.id,
      title: p.caption ? (p.caption.length > 50 ? p.caption.slice(0, 50) + '...' : p.caption) : 'Untitled Post',
      caption: p.caption,
      date: eventDate,
      status: p.status,
      timezone: p.timezone,
      mediaCount: media.length,
      thumbnail: media[0]?.url || null,
      targets,
      platforms: (p.platforms || '').split(',').filter(Boolean),
    };
  });

  res.json({ events });
});

export default router;
