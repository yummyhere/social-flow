import { Router, Request, Response } from 'express';
import { config } from '../config.ts';
import { scheduler } from '../scheduler.ts';
import { get } from '../db.ts';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  const schedulerStats = scheduler.getStats();

  const counts = get<any>(`
    SELECT 
      (SELECT COUNT(*) FROM users) as user_count,
      (SELECT COUNT(*) FROM social_accounts) as account_count,
      (SELECT COUNT(*) FROM social_posts) as post_count,
      (SELECT COUNT(*) FROM publishing_attempts) as attempt_count
  `);

  res.json({
    serverTimeUtc: new Date().toISOString(),
    environment: config.nodeEnv,
    appUrl: config.appUrl,
    meta: {
      isConfigured: config.meta.isConfigured,
      appIdMasked: config.meta.appId
        ? `${config.meta.appId.slice(0, 4)}...${config.meta.appId.slice(-4)}`
        : 'Not Set',
      apiVersion: config.meta.apiVersion,
      redirectUri: config.meta.redirectUri,
    },
    scheduler: schedulerStats,
    database: {
      status: 'healthy',
      stats: {
        users: counts?.user_count || 0,
        connectedAccounts: counts?.account_count || 0,
        posts: counts?.post_count || 0,
        publishingAttempts: counts?.attempt_count || 0,
      },
    },
    metaSetupInstructions: {
      title: 'Meta Developer App Setup Guide',
      steps: [
        '1. Log into https://developers.facebook.com and create a Business App.',
        '2. In Dashboard, add "Facebook Login for Business".',
        '3. Go to Facebook Login > Settings and add the Valid OAuth Redirect URI: ' + config.meta.redirectUri,
        '4. In App Roles / Permissions, request "pages_show_list", "pages_read_engagement", "pages_manage_posts", "business_management", and "instagram_content_publish".',
        '5. Copy your App ID and App Secret into META_APP_ID and META_APP_SECRET environment variables.',
        '6. For testing prior to Meta App Review, use the App Administrator or Developer account to publish to owned Facebook Pages and connected Instagram Professional accounts.',
      ],
    },
  });
});

export default router;
