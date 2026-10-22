import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './server/config.ts';
import { initDatabase } from './server/db.ts';
import { scheduler } from './server/scheduler.ts';

import authRouter from './server/routes/auth.ts';
import socialRouter from './server/routes/social.ts';
import postsRouter from './server/routes/posts.ts';
import calendarRouter from './server/routes/calendar.ts';
import mediaRouter from './server/routes/media.ts';
import systemRouter from './server/routes/system.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Initialize persistent SQLite database
  await initDatabase();
  console.log('[Database] Initialized and verified persistence.');

  // Start background periodic scheduler
  scheduler.start();

  // Basic middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Static uploads serving
  const uploadDir = config.storage.uploadDir;
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/social', socialRouter);
  app.use('/api/oauth/meta', socialRouter);
  app.use('/api/posts', postsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/system', systemRouter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'socialflow',
      timestamp: new Date().toISOString(),
    });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Mount Vite dev server in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built frontend
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[SocialFlow] Server running on http://0.0.0.0:${config.port}`);
    console.log(`[SocialFlow] Meta API integration: ${config.meta.isConfigured ? 'CONFIGURED' : 'UNCONFIGURED (missing credentials)'}`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('[SocialFlow] Gracefully shutting down...');
    scheduler.stop();
    server.close(() => {
      console.log('[SocialFlow] Process terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[SocialFlow] Fatal startup error:', err);
  process.exit(1);
});
