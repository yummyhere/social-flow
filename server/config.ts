import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface ServerConfig {
  port: number;
  appUrl: string;
  nodeEnv: string;
  defaultTimezone: string;
  jwtSecret: string;
  tokenEncryptionKey: string;
  meta: {
    appId: string;
    appSecret: string;
    apiVersion: string;
    redirectUri: string;
    isConfigured: boolean;
  };
  storage: {
    type: 'local' | 's3';
    uploadDir: string;
  };
}

const rawAppUrl = process.env.APP_URL || 'http://localhost:3000';
const normalizedAppUrl = rawAppUrl.replace(/\/$/, '');

const metaAppId = process.env.META_APP_ID || '';
const metaAppSecret = process.env.META_APP_SECRET || '';
const isMetaConfigured = Boolean(
  metaAppId &&
  metaAppSecret &&
  metaAppId !== 'YOUR_META_APP_ID' &&
  metaAppSecret !== 'YOUR_META_APP_SECRET'
);

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  appUrl: normalizedAppUrl,
  nodeEnv: process.env.NODE_ENV || 'development',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'UTC',
  jwtSecret: process.env.JWT_SECRET || 'socialflow-super-secure-production-jwt-secret-min-32-chars-2026',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || 'socialflow-aes-256-encryption-key-for-social-tokens-32b',
  meta: {
    appId: metaAppId,
    appSecret: metaAppSecret,
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    redirectUri: process.env.META_REDIRECT_URI || `${normalizedAppUrl}/api/oauth/meta/callback`,
    isConfigured: isMetaConfigured,
  },
  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 's3') || 'local',
    uploadDir: path.resolve(process.cwd(), process.env.MEDIA_UPLOAD_DIR || 'uploads'),
  },
};
