import crypto from 'crypto';
import { query, get, run, transaction } from './db.ts';
import { metaService } from './metaService.ts';
import { decryptToken } from './crypto.ts';

export interface SchedulerStats {
  workerId: string;
  isPolling: boolean;
  lastTickAt: string | null;
  runningJobsCount: number;
  totalProcessedCount: number;
  consecutiveErrors: number;
}

export class BackgroundScheduler {
  private workerId: string;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private lastTickAt: string | null = null;
  private totalProcessedCount: number = 0;
  private consecutiveErrors: number = 0;

  constructor(pollIntervalMs: number = 5000) {
    this.workerId = `worker-${crypto.randomBytes(4).toString('hex')}`;
    this.pollIntervalMs = pollIntervalMs;
  }

  start(): void {
    if (this.timer) return;
    console.log(`[Scheduler ${this.workerId}] Starting background scheduler (interval: ${this.pollIntervalMs}ms)...`);
    
    // Initial startup reconciliation
    this.reconcileInterruptedJobs();

    // Start polling loop
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        this.consecutiveErrors++;
        console.error(`[Scheduler ${this.workerId}] Unhandled tick error:`, err);
      });
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log(`[Scheduler ${this.workerId}] Stopped background scheduler.`);
    }
  }

  getStats(): SchedulerStats {
    return {
      workerId: this.workerId,
      isPolling: this.timer !== null,
      lastTickAt: this.lastTickAt,
      runningJobsCount: this.isProcessing ? 1 : 0,
      totalProcessedCount: this.totalProcessedCount,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  /**
   * Reconcile jobs that were interrupted if server or process crashed while publishing.
   */
  public reconcileInterruptedJobs(): void {
    const nowIso = new Date().toISOString();
    // Jobs that have been locked for more than 5 minutes or left in 'publishing'
    const stalePosts = query<any>(
      `SELECT id, status, locked_at FROM social_posts 
       WHERE status = 'publishing' AND (locked_at IS NULL OR datetime(locked_at, '+5 minutes') < datetime(?))`,
      [nowIso]
    );

    for (const post of stalePosts) {
      console.warn(`[Scheduler] Reconciling stale publishing post ${post.id}`);
      // Check if targets have succeeded or are pending
      const targets = query<any>(`SELECT id, target_status FROM post_targets WHERE post_id = ?`, [post.id]);
      const allPublished = targets.length > 0 && targets.every((t) => t.target_status === 'published');
      const somePublished = targets.some((t) => t.target_status === 'published');
      const allFailed = targets.every((t) => t.target_status === 'failed');

      let newStatus = 'scheduled';
      if (allPublished) newStatus = 'published';
      else if (somePublished) newStatus = 'partially_published';
      else if (allFailed) newStatus = 'failed';

      run(
        `UPDATE social_posts 
         SET status = ?, locked_at = NULL, locked_by = NULL, updated_at = ? 
         WHERE id = ?`,
        [newStatus, nowIso, post.id]
      );
    }
  }

  /**
   * Main periodic loop: Claims due posts and dispatches them.
   */
  private async tick(): Promise<void> {
    if (this.isProcessing) return;
    this.lastTickAt = new Date().toISOString();
    this.isProcessing = true;

    try {
      const nowIso = new Date().toISOString();

      // Find due posts in status 'scheduled' with scheduled_at_utc <= now
      const duePosts = query<{ id: string; user_id: string; scheduled_at_utc: string }>(
        `SELECT id, user_id, scheduled_at_utc FROM social_posts 
         WHERE status = 'scheduled' 
           AND scheduled_at_utc IS NOT NULL 
           AND scheduled_at_utc <= ? 
           AND (locked_at IS NULL OR datetime(locked_at, '+5 minutes') < datetime(?))
         ORDER BY scheduled_at_utc ASC 
         LIMIT 5`,
        [nowIso, nowIso]
      );

      for (const post of duePosts) {
        await this.processPost(post.id);
      }

      this.consecutiveErrors = 0;
    } catch (err) {
      console.error(`[Scheduler ${this.workerId}] Tick error:`, err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Claims and publishes a single post safely.
   * Note: We NEVER hold a DB transaction open during external HTTP calls to Meta.
   */
  public async processPost(postId: string): Promise<boolean> {
    const claimTimeIso = new Date().toISOString();

    // 1. Transactionally claim the post
    const claimed = transaction<boolean>(() => {
      const current = get<any>(
        `SELECT id, status, locked_at FROM social_posts WHERE id = ?`,
        [postId]
      );
      if (!current || (current.status !== 'scheduled' && current.status !== 'publishing')) {
        return false;
      }
      run(
        `UPDATE social_posts 
         SET status = 'publishing', locked_at = ?, locked_by = ?, updated_at = ?
         WHERE id = ?`,
        [claimTimeIso, this.workerId, claimTimeIso, postId]
      );
      return true;
    });

    if (!claimed) return false;

    console.log(`[Scheduler ${this.workerId}] Claimed post ${postId} for publishing.`);

    // 2. Read post details outside transaction
    const post = get<any>(`SELECT * FROM social_posts WHERE id = ?`, [postId]);
    if (!post) return false;

    let mediaUrls: Array<{ url: string; mime_type: string }> = [];
    try {
      mediaUrls = JSON.parse(post.media_urls || '[]');
    } catch {}

    // Use LEFT JOIN so targets referencing deleted social accounts are still returned
    // (INNER JOIN would silently drop them and cause a false 'published' status)
    const targets = query<any>(
      `SELECT pt.*, sa.platform as sa_platform, sa.platform_account_id, sa.display_name, 
              sa.encrypted_access_token, sa.token_iv, sa.token_tag, sa.connection_status
       FROM post_targets pt
       LEFT JOIN social_accounts sa ON pt.social_account_id = sa.id
       WHERE pt.post_id = ? AND pt.target_status != 'published'`,
      [postId]
    );

    if (targets.length === 0) {
      // All targets already published — mark post as completed
      run(
        `UPDATE social_posts SET status = 'published', locked_at = NULL, locked_by = NULL, published_at = ? WHERE id = ?`,
        [new Date().toISOString(), postId]
      );
      return true;
    }

    // Pre-flight: mark targets whose linked social account no longer exists as failed
    const nowIso = new Date().toISOString();
    for (const target of targets) {
      if (!target.sa_platform) {
        console.warn(`[Scheduler ${this.workerId}] Target ${target.id} references a deleted social account. Marking as failed.`);
        run(
          `UPDATE post_targets 
           SET target_status = 'failed', last_error_code = 'ACCOUNT_DELETED',
               last_error_message = 'The linked social account has been disconnected or deleted. Please recreate this post with an active account.',
               updated_at = ?
           WHERE id = ?`,
          [nowIso, target.id]
        );
      }
    }

    // Only process targets that have a valid, linked social account
    const validTargets = targets.filter((t: any) => t.sa_platform);
    if (validTargets.length === 0) {
      // All targets had deleted accounts — fail the post
      run(
        `UPDATE social_posts SET status = 'failed', locked_at = NULL, locked_by = NULL, updated_at = ? WHERE id = ?`,
        [nowIso, postId]
      );
      console.warn(`[Scheduler ${this.workerId}] Post ${postId} failed: all targets reference deleted accounts.`);
      return false;
    }

    // 3. Process each valid target individually (NO DB TRANSACTION HELD DURING NETWORK CALLS)
    for (const target of validTargets) {
      await this.publishSingleTarget(post, target, mediaUrls);
    }

    // 4. Derive overall post status based on final target states
    const finalTargets = query<any>(`SELECT target_status FROM post_targets WHERE post_id = ?`, [postId]);
    const allPublished = finalTargets.every((t) => t.target_status === 'published');
    const somePublished = finalTargets.some((t) => t.target_status === 'published');
    const allFailed = finalTargets.every((t) => t.target_status === 'failed');

    let finalStatus: string;
    let publishedAt: string | null = null;

    if (allPublished) {
      finalStatus = 'published';
      publishedAt = new Date().toISOString();
    } else if (somePublished) {
      finalStatus = 'partially_published';
      publishedAt = new Date().toISOString();
    } else if (allFailed) {
      finalStatus = 'failed';
    } else {
      finalStatus = 'publishing';
    }

    run(
      `UPDATE social_posts 
       SET status = ?, locked_at = NULL, locked_by = NULL, published_at = ?, updated_at = ?
       WHERE id = ?`,
      [finalStatus, publishedAt, new Date().toISOString(), postId]
    );

    this.totalProcessedCount++;
    console.log(`[Scheduler ${this.workerId}] Finished post ${postId} with overall status '${finalStatus}'.`);
    return true;
  }

  /**
   * Publishes to a single target and records attempt
   */
  private async publishSingleTarget(
    post: any,
    target: any,
    mediaUrls: Array<{ url: string; mime_type: string }>
  ): Promise<void> {
    const attemptStart = new Date().toISOString();
    const attemptNumber = (target.attempt_count || 0) + 1;
    let result: any;

    try {
      // Mark target as publishing
      run(`UPDATE post_targets SET target_status = 'publishing', attempt_count = ? WHERE id = ?`, [
        attemptNumber,
        target.id,
      ]);

      // Check account connection status
      if (target.connection_status !== 'active') {
        throw new Error(
          `Target social account "${target.display_name}" is in '${target.connection_status}' status. Reconnection required.`
        );
      }

      // Decrypt access token
      let decryptedToken: string;
      try {
        decryptedToken = decryptToken({
          ciphertext: target.encrypted_access_token,
          iv: target.token_iv,
          tag: target.token_tag,
        });
      } catch (err) {
        throw new Error('Failed to decrypt account access token. Encryption key may have changed.');
      }

      // Execute platform-specific API call
      if (target.platform === 'facebook') {
        result = await metaService.publishToFacebookPage(
          target.platform_account_id,
          decryptedToken,
          {
            caption: post.caption,
            mediaUrls,
          }
        );
      } else if (target.platform === 'instagram') {
        result = await metaService.publishToInstagram(
          target.platform_account_id,
          decryptedToken,
          {
            caption: post.caption,
            mediaUrls,
          }
        );
      } else {
        throw new Error(`Unsupported platform: ${target.platform}`);
      }
    } catch (err: any) {
      result = {
        success: false,
        errorCode: 'EXECUTION_EXCEPTION',
        errorMessage: err.message || 'Unexpected exception during target publishing',
        requestSummary: `Target: ${target.platform} (${target.platform_account_id})`,
        responseSummary: `Exception: ${err.message}`,
      };
    }

    const attemptEnd = new Date().toISOString();
    const attemptId = crypto.randomUUID();

    // Persist attempt record
    run(
      `INSERT INTO publishing_attempts 
       (id, target_id, post_id, attempt_number, started_at, completed_at, result, error_code, error_message, api_request_summary, api_response_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        target.id,
        post.id,
        attemptNumber,
        attemptStart,
        attemptEnd,
        result.success ? 'success' : 'failed',
        result.errorCode || null,
        result.errorMessage || null,
        result.requestSummary || '',
        result.responseSummary || '',
      ]
    );

    // Update target status
    if (result.success) {
      run(
        `UPDATE post_targets 
         SET target_status = 'published', external_post_id = ?, external_post_url = ?, 
             last_error_code = NULL, last_error_message = NULL, published_at = ?, updated_at = ?
         WHERE id = ?`,
        [result.externalPostId || null, result.externalPostUrl || null, attemptEnd, attemptEnd, target.id]
      );
    } else {
      run(
        `UPDATE post_targets 
         SET target_status = 'failed', last_error_code = ?, last_error_message = ?, updated_at = ?
         WHERE id = ?`,
        [result.errorCode || 'UNKNOWN_ERROR', result.errorMessage || 'Publishing failed', attemptEnd, target.id]
      );
    }
  }
}

export const scheduler = new BackgroundScheduler();
