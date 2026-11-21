import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pool } from './db';
import { errorHandler } from './lib/http';
import routes from './routes';

/** The Express app (no listening here, so tests can start it on any port). */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // correct client IP behind nginx / a load balancer (rate limits, audit log)
  app.use(helmet({ contentSecurityPolicy: { directives: { 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'], 'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'], 'script-src': ["'self'"], 'connect-src': ["'self'"] } } }));
  const corsOrigins = new Set((process.env.CORS_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean));
  app.use(cors({ origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Vercel assigns a unique hostname to each admin deployment. Keep these
    // project-style admin URLs usable while still rejecting unrelated origins.
    const isAdminPreview = /^https:\/\/admin-[a-z0-9-]+\.vercel\.app$/i.test(origin);
    callback(null, corsOrigins.has(origin) || isAdminPreview);
  } }));

  // request id + one JSON log line per request; the id is echoed in every error so support can find the exact failure
  app.use((req, res, next) => {
    const id = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 64), t0 = Date.now();
    req.id = id;
    res.setHeader('x-request-id', id);
    res.on('finish', () => { if (req.path !== '/health' && process.env.NODE_ENV !== 'test') console.log(JSON.stringify({ id, m: req.method, p: req.originalUrl.split('?')[0], s: res.statusCode, ms: Date.now() - t0 })); });
    next();
  });
  app.use(express.json({ limit: '12mb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: process.env.NODE_ENV === 'test' ? 100_000 : 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please slow down.' } }));

  app.get('/health', async (_req, res) => {
    try { await pool.query('select 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
  });
  app.use('/api', routes);
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found' }));

  // the admin panel (built with `npm run build` in /admin) is served from the same server → one thing to deploy, no CORS
  const adminDir = path.resolve(process.env.ADMIN_DIST ?? path.join(__dirname, '../../admin/dist'));
  if (fs.existsSync(path.join(adminDir, 'index.html'))) {
    app.use('/admin', express.static(adminDir, { index: false, maxAge: '1h' }));
    app.get(/^\/admin(\/.*)?$/, (_req, res) => void res.sendFile(path.join(adminDir, 'index.html')));
    app.get('/', (_req, res) => void res.redirect('/admin/'));
  }
  app.use((_req, res) => void res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
