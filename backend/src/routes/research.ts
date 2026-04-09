import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { logAudit } from '../middleware/audit';
import { anonClient, adminClient } from '../services/supabase';
import { runPipeline, runUpdatePipeline } from '../services/pipeline';
import { generateDiff } from '../services/diff';
import { validateTicker } from '../utils/ticker';
import type { EmitFn, SSEEvent, ReportJson, PipelineResult } from '../types/report.types';
import type { Json } from '../types/database.types';

const router = Router();

/** Stricter rate limit for research trigger endpoints (POST/PUT). */
const researchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
  },
});

/**
 * Express params values are typed as string | string[].
 * Route params (e.g. :ticker) are always strings at runtime — this helper
 * normalises the union type to a plain string.
 */
function getTickerParam(ticker: string | string[] | undefined): string {
  if (Array.isArray(ticker)) return ticker[0] ?? '';
  return ticker ?? '';
}

// ─── GET /api/v1/research ─────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await anonClient
      .from('research_reports')
      .select('ticker_symbol, score, updated_at, version, tickers(company_name, sector)')
      .order('updated_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch research list', code: 'DB_ERROR' });
      return;
    }

    res.json({ data: data ?? [] });
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/v1/research/:ticker/versions ───────────────────────────────────
// Declared before /:ticker to prevent 'versions' being matched as a ticker symbol

router.get('/:ticker/versions', async (req, res) => {
  try {
    const { valid, normalised } = validateTicker(getTickerParam(req.params.ticker));
    if (!valid) {
      res.status(400).json({ error: 'Invalid ticker symbol', code: 'INVALID_TICKER' });
      return;
    }

    const { data, error } = await anonClient
      .from('research_versions')
      .select('id, ticker_symbol, version, score, diff_json, researched_by, created_at')
      .eq('ticker_symbol', normalised)
      .order('version', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch versions', code: 'DB_ERROR' });
      return;
    }

    res.json({ data: data ?? [] });
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── GET /api/v1/research/:ticker ────────────────────────────────────────────

router.get('/:ticker', async (req, res) => {
  try {
    const { valid, normalised } = validateTicker(getTickerParam(req.params.ticker));
    if (!valid) {
      res.status(400).json({ error: 'Invalid ticker symbol', code: 'INVALID_TICKER' });
      return;
    }

    const { data, error } = await anonClient
      .from('research_reports')
      .select('*, tickers(symbol, company_name, sector, industry, first_researched_at, last_researched_at, research_count)')
      .eq('ticker_symbol', normalised)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: 'Failed to fetch report', code: 'DB_ERROR' });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' });
      return;
    }

    void logAudit('report_viewed', req, { ticker_symbol: normalised });
    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }
});

// ─── POST /api/v1/research/:ticker ───────────────────────────────────────────

router.post(
  '/:ticker',
  researchLimiter,
  authenticate,
  requireRole('approved'),
  async (req, res) => {
    try {
      const { valid, normalised } = validateTicker(getTickerParam(req.params.ticker));
      if (!valid) {
        res.status(400).json({ error: 'Invalid ticker symbol', code: 'INVALID_TICKER' });
        return;
      }

      // Race condition guard — check cache again
      const { data: existing } = await anonClient
        .from('research_reports')
        .select('id')
        .eq('ticker_symbol', normalised)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Report already exists', code: 'ALREADY_EXISTS' });
        return;
      }

      // Ensure ticker row exists (insert if not, no-op if already present)
      const { data: tickerRow, error: tickerErr } = await adminClient
        .from('tickers')
        .upsert({ symbol: normalised }, { onConflict: 'symbol' })
        .select('id, research_count')
        .single();

      if (tickerErr ?? !tickerRow) {
        res.status(500).json({ error: 'Failed to create ticker', code: 'DB_ERROR' });
        return;
      }

      // Start SSE stream — no JSON errors possible after this point
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Keep connection alive through Cloudflare / Render proxy timeouts
      const keepAlive = setInterval(() => { res.write(': ping\n\n'); }, 30000);

      const emit: EmitFn = (event: SSEEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      void logAudit('research_triggered', req, { ticker_symbol: normalised });

      let pipelineResult: PipelineResult;
      try {
        pipelineResult = await runPipeline(normalised, emit);
      } catch (pipelineErr) {
        const message = pipelineErr instanceof Error ? pipelineErr.message : 'Pipeline failed';
        emit({ step: 0, label: 'Error', status: 'error', data: { message } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { report, diagram } = pipelineResult;
      console.log(`[research POST] pipeline complete for ${normalised} — report keys: ${Object.keys(report).join(', ')}`);

      const score = typeof report.sector_heat === 'number' ? report.sector_heat : null;

      // Signal save in progress — keeps SSE connection alive during DB write
      emit({ step: 8, label: 'Saving Report', status: 'saving' });
      console.log(`[research POST] saving report for ${normalised}...`);

      const { data: savedReport, error: reportErr } = await adminClient
        .from('research_reports')
        .insert({
          ticker_id: tickerRow.id,
          ticker_symbol: normalised,
          score,
          report_json: report as unknown as Json,
          diagram_json: diagram as unknown as Json,
          version: 1,
          researched_by: req.user?.id ?? null,
        })
        .select('id')
        .single();

      if (reportErr) {
        console.error('[research POST] research_reports insert failed:', JSON.stringify(reportErr));
        emit({ step: 0, label: 'Error', status: 'error', data: { message: `Failed to save report: ${reportErr.message}` } });
        clearInterval(keepAlive);
        res.end();
        return;
      }
      if (!savedReport) {
        console.error('[research POST] research_reports insert returned no data');
        emit({ step: 0, label: 'Error', status: 'error', data: { message: 'Failed to save report: no data returned' } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { error: versionsErr } = await adminClient.from('research_versions').insert({
        ticker_id: tickerRow.id,
        ticker_symbol: normalised,
        version: 1,
        score,
        report_json: report as unknown as Json,
        diagram_json: diagram as unknown as Json,
        diff_json: null,
        researched_by: req.user?.id ?? null,
      });
      if (versionsErr) {
        console.error('[research POST] research_versions insert failed:', JSON.stringify(versionsErr));
        emit({ step: 0, label: 'Error', status: 'error', data: { message: `Failed to save version: ${versionsErr.message}` } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      await adminClient
        .from('tickers')
        .update({
          research_count: tickerRow.research_count + 1,
          last_researched_at: new Date().toISOString(),
        })
        .eq('id', tickerRow.id);

      console.log(`[research POST] report saved — id: ${savedReport.id}, ticker: ${normalised}`);
      clearInterval(keepAlive);
      emit({ step: 8, label: 'Saved', status: 'complete', data: { id: savedReport.id } });
      res.end();
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
      } else {
        res.end();
      }
    }
  },
);

// ─── PUT /api/v1/research/:ticker ────────────────────────────────────────────

router.put(
  '/:ticker',
  researchLimiter,
  authenticate,
  requireRole('approved'),
  async (req, res) => {
    try {
      const { valid, normalised } = validateTicker(getTickerParam(req.params.ticker));
      if (!valid) {
        res.status(400).json({ error: 'Invalid ticker symbol', code: 'INVALID_TICKER' });
        return;
      }

      const { data: existingReport, error: fetchErr } = await anonClient
        .from('research_reports')
        .select('id, ticker_id, version, score, report_json')
        .eq('ticker_symbol', normalised)
        .single();

      if (fetchErr ?? !existingReport) {
        res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' });
        return;
      }

      // Start SSE stream
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Keep connection alive through Cloudflare / Render proxy timeouts
      const keepAlive = setInterval(() => { res.write(': ping\n\n'); }, 30000);

      const emit: EmitFn = (event: SSEEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      void logAudit('research_updated', req, { ticker_symbol: normalised });

      const prevReport = existingReport.report_json as unknown as ReportJson;

      let pipelineResult: PipelineResult;
      try {
        pipelineResult = await runUpdatePipeline(normalised, prevReport, emit);
      } catch (pipelineErr) {
        const message = pipelineErr instanceof Error ? pipelineErr.message : 'Pipeline failed';
        emit({ step: 0, label: 'Error', status: 'error', data: { message } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { report, diagram } = pipelineResult;
      const newScore = typeof report.sector_heat === 'number' ? report.sector_heat : null;
      const newVersion = existingReport.version + 1;

      const prevScore = typeof existingReport.score === 'number' ? existingReport.score : null;
      const diff = generateDiff(prevReport, prevScore, report, newScore);

      // Signal save in progress — keeps SSE connection alive during DB write
      emit({ step: 8, label: 'Saving Report', status: 'saving' });
      console.log(`[research PUT] saving report v${newVersion} for ${normalised}...`);

      try {
        const { error: updateErr } = await adminClient
          .from('research_reports')
          .update({
            score: newScore,
            report_json: report as unknown as Json,
            diagram_json: diagram as unknown as Json,
            version: newVersion,
            researched_by: req.user?.id ?? null,
          })
          .eq('id', existingReport.id);

        if (updateErr) {
          console.error('[research PUT] research_reports update failed:', JSON.stringify(updateErr));
          emit({ step: 0, label: 'Error', status: 'error', data: { message: `Failed to save report: ${updateErr.message}` } });
          clearInterval(keepAlive);
          res.end();
          return;
        }

        const { error: versionsErr } = await adminClient.from('research_versions').insert({
          ticker_id: existingReport.ticker_id,
          ticker_symbol: normalised,
          version: newVersion,
          score: newScore,
          report_json: report as unknown as Json,
          diagram_json: diagram as unknown as Json,
          diff_json: diff as unknown as Json,
          researched_by: req.user?.id ?? null,
        });

        if (versionsErr) {
          console.error('[research PUT] research_versions insert failed:', JSON.stringify(versionsErr));
          emit({ step: 0, label: 'Error', status: 'error', data: { message: `Failed to save version: ${versionsErr.message}` } });
          clearInterval(keepAlive);
          res.end();
          return;
        }
      } catch (saveErr) {
        console.error('[research PUT] SAVE EXCEPTION:', saveErr);
        emit({ step: 0, label: 'Error', status: 'error', data: { message: `Save exception: ${String(saveErr)}` } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      await adminClient
        .from('tickers')
        .update({ last_researched_at: new Date().toISOString() })
        .eq('id', existingReport.ticker_id);

      console.log(`[research PUT] report saved — v${newVersion}, ticker: ${normalised}`);
      clearInterval(keepAlive);
      emit({
        step: 8,
        label: 'Saved',
        status: 'complete',
        data: { version: newVersion, diff_summary: diff.summary },
      });
      res.end();
    } catch {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
      } else {
        res.end();
      }
    }
  },
);

export default router;
