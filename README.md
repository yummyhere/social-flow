# SocialFlow: Production-Ready Social Media Scheduling & Auto-Publishing Platform

SocialFlow is a multi-user social media management platform engineered for scheduling and automatically publishing content to authorized **Facebook Pages** and eligible **Instagram Professional (Business & Creator)** accounts.

---

## 1. Architectural Highlights

- **Multi-Tenant Workspace Isolation**: Authenticated users have fully isolated accounts, posts, calendar schedules, and media uploads. Cross-tenant access is strictly denied.
- **Official Meta Graph API Integration**: Built directly against Meta's Graph API (`v21.0`), using official OAuth token exchanges, long-lived token rotation, Facebook Page feed/photo/video publishing, and Instagram Content Publishing container lifecycles (`/media` -> container status polling -> `/media_publish`).
- **AES-256-GCM Token Encryption**: Social media access tokens are encrypted with AES-256-GCM before database insertion. Tokens are never exposed in frontend responses or client logs.
- **Persistent Server-Side Scheduler**: Independent background worker loop that runs independently of browser sessions, claims due jobs with ACID row locking, prevents duplicate publishing, records granular audit logs (`PublishingAttempt`), and safely reconciles interrupted jobs after server restarts.
- **Platform-Specific Validation Engine**:
  - **Facebook**: Supports text-only posts, single/multiple photos, and videos. Max caption length: 63,206 characters.
  - **Instagram**: Strictly requires image or video media (text-only posts are rejected by Meta API). Validates aspect ratios (4:5 to 1.91:1 for photos; 9:16 to 16:9 for videos) and enforces max 2,200 characters and max 30 hashtags.
- **Interactive Content Calendar**: Month, Week, and Day views with platform indicators, timezone display, date-click post creation, and live filters.

---

## 2. Meta Developer Setup Guide

To connect Facebook Pages and Instagram accounts for live publishing:

1. **Create a Meta App**:
   - Navigate to [Meta for Developers](https://developers.facebook.com).
   - Create an app of type **Business**.
2. **Add Facebook Login for Business**:
   - In your App Dashboard, add the **Facebook Login for Business** product.
   - Go to **Facebook Login > Settings** and add the following to **Valid OAuth Redirect URIs**:
     ```
     https://<YOUR_APP_DOMAIN>/api/oauth/meta/callback
     ```
     (For local development: `http://localhost:3000/api/oauth/meta/callback`)
3. **Configure Permissions**:
   - Request the following scopes:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_posts`
     - `business_management`
     - `instagram_basic`
     - `instagram_content_publish`
4. **Set Environment Variables**:
   - Add your App ID and App Secret to your `.env` or cloud secret manager:
     ```env
     META_APP_ID="YOUR_META_APP_ID"
     META_APP_SECRET="YOUR_META_APP_SECRET"
     META_API_VERSION="v21.0"
     META_REDIRECT_URI="http://localhost:3000/api/oauth/meta/callback"
     ```
5. **Testing Prior to App Review**:
   - Prior to public Meta App Review, use Meta App Administrators or Developer accounts to connect Facebook Pages and Instagram Professional accounts.
   - You can also use the **Direct Token Connect** feature in the Connected Accounts page to connect via a verified Page Access Token or System User Token.

---

## 3. Running Automated Tests

Run the complete test suite using Node's native test runner:

```bash
npm test
# or
node --test src/tests/*.test.ts
```

The test suite covers:
- AES-256-GCM encryption, decryption, and tamper detection.
- Cryptographic state generation.
- Facebook caption and media limits.
- Instagram media requirements, aspect ratio rules, and hashtag limits.
- Status derivation across multiple platform targets.
- Bounded exponential retry backoff.
- Due post detection and UTC timestamp handling.
- Stale lock detection and crash recovery.
- Multi-target error isolation.

---

## 4. Production Docker Deployment

Deploy with PostgreSQL and Redis:

```bash
docker-compose up -d --build
```

This starts:
- `db`: PostgreSQL 16 database.
- `redis`: Redis 7 broker.
- `web`: SocialFlow web application with health checks on `/health`.

---

## 5. Security & Isolation

- Passwords hashed using `bcrypt` (10 rounds).
- Authenticated JWT bearer tokens with 7-day expiration.
- SQL parameterized queries preventing SQL injection.
- Strict object-level ownership checks on all endpoints (`user_id = req.user.id`).
