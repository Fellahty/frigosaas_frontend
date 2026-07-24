import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  const subpath = (req.body.path as string) || 'uploads';
  const destDir = path.join(uploadsDir, subpath);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const finalPath = path.join(destDir, req.file.filename);
  fs.renameSync(req.file.path, finalPath);

  const url = `/uploads/${subpath}/${req.file.filename}`;
  return sendSuccess(res, { url, path: url });
});

export default router;
