import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.ts';
import { query, get, run } from '../db.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, timezone } = req.body;

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'Email, password, and full name are required.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = get(`SELECT id FROM users WHERE email = ?`, [normalizedEmail]);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const userTimezone = timezone || config.defaultTimezone;

    run(
      `INSERT INTO users (id, email, password_hash, full_name, timezone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, normalizedEmail, passwordHash, full_name.trim(), userTimezone, nowIso, nowIso]
    );

    const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: userId,
        email: normalizedEmail,
        full_name: full_name.trim(),
        timezone: userTimezone,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = get<any>(`SELECT * FROM users WHERE email = ?`, [normalizedEmail]);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        timezone: user.timezone,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

router.put('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { full_name, timezone } = req.body;
  const userId = req.user!.id;
  const nowIso = new Date().toISOString();

  run(
    `UPDATE users 
     SET full_name = COALESCE(?, full_name), 
         timezone = COALESCE(?, timezone), 
         updated_at = ? 
     WHERE id = ?`,
    [full_name || null, timezone || null, nowIso, userId]
  );

  const updated = get(`SELECT id, email, full_name, timezone FROM users WHERE id = ?`, [userId]);
  res.json({ user: updated });
});

export default router;
