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

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());

// Global rate limit: 60 requests per minute
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
    },
  }),
);

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
