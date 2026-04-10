import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health';
import researchRouter from './routes/research';
import adminRouter from './routes/admin';
import { adminClient } from './services/supabase';

const app = express();

// ─── Global middleware ────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          process.env.SUPABASE_URL ?? '',
          'https://api.anthropic.com',
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  }),
);
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());

// Global rate limit: 100 requests per minute
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
  },
});

// Stricter limit on research trigger routes (5 per minute per IP)
const researchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Research rate limit exceeded', code: 'RATE_LIMITED' });
  },
});

app.use(globalLimiter);
app.use('/api/v1/research', researchLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/research', researchRouter);
app.use('/api/v1', adminRouter);

// ─── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`moat-finder backend listening on port ${String(port)}`);

  void adminClient
    .from('research_checkpoints')
    .select('id')
    .limit(1)
    .then(({ error }) => {
      if (error) {
        console.error('❌ research_checkpoints table check failed:', error.message);
      } else {
        console.log('✅ research_checkpoints table OK');
      }
    });
});

export default app;
