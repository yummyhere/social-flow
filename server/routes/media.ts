import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

const uploadDir = config.storage.uploadDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type ${file.mimetype}. Allowed: JPEG, PNG, WebP, MP4, MOV.`));
    }
  },
});

router.post('/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No media file provided.' });
    return;
  }

  const file = req.file;
  const relativeUrl = `/uploads/${file.filename}`;
  const fullUrl = `${config.appUrl}${relativeUrl}`;

  res.status(201).json({
    url: relativeUrl,
    fullUrl,
    filename: file.filename,
    originalName: file.originalname,
    mime_type: file.mimetype,
    size_bytes: file.size,
  });
});

export default router;
