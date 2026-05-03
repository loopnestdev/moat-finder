import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { logAudit } from "../middleware/audit";
import { anonClient, adminClient } from "../services/supabase";
import {
  runPipeline,
  runUpdatePipeline,
  runDiscoveryOnly,
  runFromCheckpoint,
} from "../services/pipeline";
import type { LLMProvider } from "../services/llm";
import { clearCheckpoints } from "../services/checkpoint";
import { generateDiff } from "../services/diff";
import { validateTicker } from "../utils/ticker";
import type {
  EmitFn,
  SSEEvent,
  ReportJson,
  PipelineResult,
} from "../types/report.types";
import type { Json } from "../types/database.types";

const router = Router();

/** Stricter rate limit for research trigger endpoints (POST/PUT). */
const researchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many requests", code: "RATE_LIMITED" });
  },
});

/**
 * Express params values are typed as string | string[].
 * Route params (e.g. :ticker) are always strings at runtime — this helper
 * normalises the union type to a plain string.
 */
function getTickerParam(ticker: string | string[] | undefined): string {
  if (Array.isArray(ticker)) return ticker[0] ?? "";
  return ticker ?? "";
}

// ─── GET /api/v1/research ─────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  try {
    const { data, error } = await anonClient
      .from("research_reports")
      .select(
        "ticker_symbol, score, updated_at, version, report_json, tickers(company_name, sector)",
      )
      .order("updated_at", { ascending: false });

    if (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch research list", code: "DB_ERROR" });
      return;
    }

    const enriched = (data ?? []).map((r) => {
      const rj = r.report_json as unknown as ReportJson | null;
      const tickers = r.tickers as {
        company_name: string | null;
        sector: string | null;
      } | null;
      return {
        ticker_symbol: r.ticker_symbol,
        company_name: tickers?.company_name ?? null,
        sector: tickers?.sector ?? null,
        score: r.score ?? null,
        updated_at: r.updated_at,
        version: r.version,
        upside_percent: rj?.napkin_math?.upside_percent ?? null,
        target_price: rj?.napkin_math?.target_price ?? null,
        hot_sector_match: rj?.hot_sector_match ?? [],
        llm_provider: rj?.llm_provider ?? "claude",
        sector_heat: rj?.sector_heat ?? null,
        thesis:
          typeof rj?.thesis === "string" ? rj.thesis.substring(0, 150) : "",
      };
    });

    res.json({ data: enriched });
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

// ─── GET /api/v1/research/:ticker/versions ───────────────────────────────────
// Declared before /:ticker to prevent 'versions' being matched as a ticker symbol

router.get("/:ticker/versions", async (req, res) => {
  try {
    const { valid, normalised } = validateTicker(
      getTickerParam(req.params.ticker),
    );
    if (!valid) {
      res
        .status(400)
        .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
      return;
    }

    const { data, error } = await anonClient
      .from("research_versions")
      .select(
        "id, ticker_symbol, version, score, diff_json, researched_by, created_at",
      )
      .eq("ticker_symbol", normalised)
      .order("version", { ascending: false });

    if (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch versions", code: "DB_ERROR" });
      return;
    }

    res.json({ data: data ?? [] });
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

// ─── GET /api/v1/research/:ticker ────────────────────────────────────────────

router.get("/:ticker", async (req, res) => {
  try {
    const { valid, normalised } = validateTicker(
      getTickerParam(req.params.ticker),
    );
    if (!valid) {
      res
        .status(400)
        .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
      return;
    }

    const { data, error } = await anonClient
      .from("research_reports")
      .select(
        "*, tickers(symbol, company_name, sector, industry, first_researched_at, last_researched_at, research_count)",
      )
      .eq("ticker_symbol", normalised)
      .maybeSingle();

    if (error) {
      res
        .status(500)
        .json({ error: "Failed to fetch report", code: "DB_ERROR" });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Report not found", code: "NOT_FOUND" });
      return;
    }

    void logAudit("report_viewed", req, { ticker_symbol: normalised });
    res.json({ data });
  } catch {
    res
      .status(500)
      .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

// ─── POST /api/v1/research/:ticker ───────────────────────────────────────────

// ─── POST /api/v1/research/:ticker/discover ──────────────────────────────────

router.post(
  "/:ticker/discover",
  researchLimiter,
  authenticate,
  requireRole("approved"),
  async (req, res) => {
    try {
      const { valid, normalised } = validateTicker(
        getTickerParam(req.params.ticker),
      );
      if (!valid) {
        res
          .status(400)
          .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
        return;
      }

      const { provider: rawProvider = "claude", correction } = req.body as {
        provider?: string;
        correction?: string;
      };
      if (!["claude", "gemini"].includes(rawProvider)) {
        res.status(400).json({
          error: "Invalid provider. Must be 'claude' or 'gemini'",
          code: "INVALID_PROVIDER",
        });
        return;
      }
      if (rawProvider === "gemini" && !process.env.GEMINI_API_KEY) {
        res.status(400).json({
          error: "Gemini API key not configured on server",
          code: "GEMINI_NOT_CONFIGURED",
        });
        return;
      }
      const provider = rawProvider as LLMProvider;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const keepAlive = setInterval(() => {
        res.write(": ping\n\n");
      }, 30000);

      const emit: EmitFn = (event: SSEEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      try {
        const { runId, step1Output } = await runDiscoveryOnly(
          normalised,
          provider,
          emit,
          typeof correction === "string" ? correction : undefined,
        );
        emit({
          step: 1,
          label: "Confirm",
          status: "confirm_required",
          data: {
            company_name: step1Output.company_name,
            ticker: normalised,
            runId,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Discovery failed";
        emit({ step: 0, label: "Error", status: "error", data: { message } });
      }

      clearInterval(keepAlive);
      res.end();
    } catch {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
      } else {
        res.end();
      }
    }
  },
);

// ─── POST /api/v1/research/:ticker/run ───────────────────────────────────────

router.post(
  "/:ticker/run",
  researchLimiter,
  authenticate,
  requireRole("approved"),
  async (req, res) => {
    try {
      const { valid, normalised } = validateTicker(
        getTickerParam(req.params.ticker),
      );
      if (!valid) {
        res
          .status(400)
          .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
        return;
      }

      const { provider: rawProvider = "claude", runId } = req.body as {
        provider?: string;
        runId?: string;
      };
      if (!["claude", "gemini"].includes(rawProvider)) {
        res.status(400).json({
          error: "Invalid provider. Must be 'claude' or 'gemini'",
          code: "INVALID_PROVIDER",
        });
        return;
      }
      if (rawProvider === "gemini" && !process.env.GEMINI_API_KEY) {
        res.status(400).json({
          error: "Gemini API key not configured on server",
          code: "GEMINI_NOT_CONFIGURED",
        });
        return;
      }
      if (typeof runId !== "string" || !runId) {
        res
          .status(400)
          .json({ error: "runId is required", code: "BAD_REQUEST" });
        return;
      }
      const provider = rawProvider as LLMProvider;

      // Race condition guard
      const { data: existing } = await anonClient
        .from("research_reports")
        .select("id")
        .eq("ticker_symbol", normalised)
        .maybeSingle();

      if (existing) {
        res
          .status(409)
          .json({ error: "Report already exists", code: "ALREADY_EXISTS" });
        return;
      }

      // Ensure ticker row exists
      const { data: tickerData, error: tickerErr } = await adminClient
        .from("tickers")
        .upsert({ symbol: normalised }, { onConflict: "symbol" })
        .select("id, research_count")
        .single();

      if (tickerErr || !tickerData) {
        console.error("[research /run] TICKER UPSERT FAILED:", tickerErr);
        res
          .status(500)
          .json({ error: "Failed to create ticker", code: "DB_ERROR" });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const keepAlive = setInterval(() => {
        res.write(": ping\n\n");
      }, 30000);

      const emit: EmitFn = (event: SSEEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      void logAudit("research_triggered", req, { ticker_symbol: normalised });

      let pipelineResult: PipelineResult;
      try {
        pipelineResult = await runFromCheckpoint(
          normalised,
          runId,
          provider,
          emit,
        );
      } catch (pipelineErr) {
        const message =
          pipelineErr instanceof Error
            ? pipelineErr.message
            : "Pipeline failed";
        emit({ step: 0, label: "Error", status: "error", data: { message } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { report, diagram, runId: completedRunId } = pipelineResult;

      const rawScore = report.score;
      const score =
        typeof rawScore === "number"
          ? rawScore
          : parseFloat(String(rawScore ?? "")) || null;

      emit({ step: 8, label: "Saving Report", status: "saving" });

      const { data: savedReport, error: reportErr } = await adminClient
        .from("research_reports")
        .insert({
          ticker_id: tickerData.id,
          ticker_symbol: normalised,
          score,
          report_json: report as unknown as Json,
          diagram_json: diagram as unknown as Json,
          version: 1,
          researched_by: req.user?.id ?? null,
        })
        .select("id")
        .single();

      if (reportErr) {
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: `Failed to save report: ${reportErr.message}` },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }
      if (!savedReport) {
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: "Failed to save report: no data returned" },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { error: versionsErr } = await adminClient
        .from("research_versions")
        .insert({
          ticker_id: tickerData.id,
          ticker_symbol: normalised,
          version: 1,
          score,
          report_json: report as unknown as Json,
          diagram_json: diagram as unknown as Json,
          diff_json: null,
          researched_by: req.user?.id ?? null,
        });
      if (versionsErr) {
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: `Failed to save version: ${versionsErr.message}` },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      await adminClient
        .from("tickers")
        .update({
          research_count: tickerData.research_count + 1,
          last_researched_at: new Date().toISOString(),
        })
        .eq("id", tickerData.id);

      void clearCheckpoints(normalised, completedRunId);
      clearInterval(keepAlive);
      emit({
        step: 8,
        label: "Saved",
        status: "complete",
        data: { id: savedReport.id },
      });
      res.end();
    } catch {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
      } else {
        res.end();
      }
    }
  },
);

// ─── POST /api/v1/research/:ticker ───────────────────────────────────────────

router.post(
  "/:ticker",
  researchLimiter,
  authenticate,
  requireRole("approved"),
  async (req, res) => {
    try {
      const { valid, normalised } = validateTicker(
        getTickerParam(req.params.ticker),
      );
      if (!valid) {
        res
          .status(400)
          .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
        return;
      }

      // Validate provider
      const { provider: rawProvider = "claude" } = req.body as {
        provider?: string;
      };
      if (!["claude", "gemini"].includes(rawProvider)) {
        res.status(400).json({
          error: "Invalid provider. Must be 'claude' or 'gemini'",
          code: "INVALID_PROVIDER",
        });
        return;
      }
      if (rawProvider === "gemini" && !process.env.GEMINI_API_KEY) {
        res.status(400).json({
          error: "Gemini API key not configured on server",
          code: "GEMINI_NOT_CONFIGURED",
        });
        return;
      }
      const provider = rawProvider as LLMProvider;

      // Race condition guard — check cache again
      const { data: existing } = await anonClient
        .from("research_reports")
        .select("id")
        .eq("ticker_symbol", normalised)
        .maybeSingle();

      if (existing) {
        res
          .status(409)
          .json({ error: "Report already exists", code: "ALREADY_EXISTS" });
        return;
      }

      // Ensure ticker row exists (insert if not, no-op if already present)
      const { data: tickerData, error: tickerErr } = await adminClient
        .from("tickers")
        .upsert({ symbol: normalised }, { onConflict: "symbol" })
        .select("id, research_count")
        .single();

      if (tickerErr || !tickerData) {
        console.error("[research POST] TICKER UPSERT FAILED:", tickerErr);
        res
          .status(500)
          .json({ error: "Failed to create ticker", code: "DB_ERROR" });
        return;
      }

      // Start SSE stream — no JSON errors possible after this point
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Keep connection alive through Cloudflare / Render proxy timeouts
      const keepAlive = setInterval(() => {
        res.write(": ping\n\n");
      }, 30000);

      const emit: EmitFn = (event: SSEEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      void logAudit("research_triggered", req, { ticker_symbol: normalised });

      let pipelineResult: PipelineResult;
      try {
        pipelineResult = await runPipeline(normalised, emit, provider);
      } catch (pipelineErr) {
        const message =
          pipelineErr instanceof Error
            ? pipelineErr.message
            : "Pipeline failed";
        emit({ step: 0, label: "Error", status: "error", data: { message } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { report, diagram, runId } = pipelineResult;
      console.log(
        `[research POST] pipeline complete for ${normalised} — report keys: ${Object.keys(report).join(", ")}`,
      );

      const rawScore = report.score;
      const score =
        typeof rawScore === "number"
          ? rawScore
          : parseFloat(String(rawScore ?? "")) || null;
      console.log(
        `[research POST] SAVING REPORT — ticker: ${normalised}, score: ${String(score)}, score_type: ${typeof rawScore}`,
      );

      // Signal save in progress — keeps SSE connection alive during DB write
      emit({ step: 8, label: "Saving Report", status: "saving" });
      console.log(`[research POST] saving report for ${normalised}...`);

      const { data: savedReport, error: reportErr } = await adminClient
        .from("research_reports")
        .insert({
          ticker_id: tickerData.id,
          ticker_symbol: normalised,
          score,
          report_json: report as unknown as Json,
          diagram_json: diagram as unknown as Json,
          version: 1,
          researched_by: req.user?.id ?? null,
        })
        .select("id")
        .single();

      if (reportErr) {
        console.error(
          "[research POST] research_reports insert failed:",
          JSON.stringify(reportErr),
        );
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: `Failed to save report: ${reportErr.message}` },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }
      if (!savedReport) {
        console.error(
          "[research POST] research_reports insert returned no data",
        );
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: "Failed to save report: no data returned" },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { error: versionsErr } = await adminClient
        .from("research_versions")
        .insert({
          ticker_id: tickerData.id,
          ticker_symbol: normalised,
          version: 1,
          score,
          report_json: report as unknown as Json,
          diagram_json: diagram as unknown as Json,
          diff_json: null,
          researched_by: req.user?.id ?? null,
        });
      if (versionsErr) {
        console.error(
          "[research POST] research_versions insert failed:",
          JSON.stringify(versionsErr),
        );
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: `Failed to save version: ${versionsErr.message}` },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      await adminClient
        .from("tickers")
        .update({
          research_count: tickerData.research_count + 1,
          last_researched_at: new Date().toISOString(),
        })
        .eq("id", tickerData.id);

      console.log(
        `[research POST] report saved — id: ${savedReport.id}, ticker: ${normalised}`,
      );
      void clearCheckpoints(normalised, runId);
      clearInterval(keepAlive);
      emit({
        step: 8,
        label: "Saved",
        status: "complete",
        data: { id: savedReport.id },
      });
      res.end();
    } catch {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
      } else {
        res.end();
      }
    }
  },
);

// ─── PUT /api/v1/research/:ticker ────────────────────────────────────────────

router.put(
  "/:ticker",
  researchLimiter,
  authenticate,
  requireRole("approved"),
  async (req, res) => {
    try {
      const { valid, normalised } = validateTicker(
        getTickerParam(req.params.ticker),
      );
      if (!valid) {
        res
          .status(400)
          .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
        return;
      }

      // Validate provider
      const { provider: rawProviderPut = "claude" } = req.body as {
        provider?: string;
      };
      if (!["claude", "gemini"].includes(rawProviderPut)) {
        res.status(400).json({
          error: "Invalid provider. Must be 'claude' or 'gemini'",
          code: "INVALID_PROVIDER",
        });
        return;
      }
      if (rawProviderPut === "gemini" && !process.env.GEMINI_API_KEY) {
        res.status(400).json({
          error: "Gemini API key not configured on server",
          code: "GEMINI_NOT_CONFIGURED",
        });
        return;
      }
      const providerPut = rawProviderPut as LLMProvider;

      const { data: existingReport, error: fetchErr } = await anonClient
        .from("research_reports")
        .select("id, ticker_id, version, score, report_json")
        .eq("ticker_symbol", normalised)
        .single();

      if (fetchErr ?? !existingReport) {
        res.status(404).json({ error: "Report not found", code: "NOT_FOUND" });
        return;
      }

      // Start SSE stream
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Keep connection alive through Cloudflare / Render proxy timeouts
      const keepAlive = setInterval(() => {
        res.write(": ping\n\n");
      }, 30000);

      const emit: EmitFn = (event: SSEEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      void logAudit("research_updated", req, { ticker_symbol: normalised });

      const prevReport = existingReport.report_json as unknown as ReportJson;

      // Clear stale checkpoints before running — provider switch clears all;
      // bad management_rating schema clears steps 2+3 only.
      try {
        const existingProvider = prevReport.llm_provider ?? "claude";
        const isSwitchingProviders = existingProvider !== providerPut;

        const mr = prevReport.management_rating;
        const managementRatingBad =
          !mr ||
          !mr.categories ||
          mr.ceo_assessment !== undefined ||
          mr.total_score === undefined;

        if (isSwitchingProviders) {
          await adminClient
            .from("research_checkpoints")
            .delete()
            .eq("ticker_symbol", normalised);
          console.log(
            `[${normalised}] Provider switch ${existingProvider}→${providerPut}: cleared ALL checkpoints`,
          );
          emit({
            step: 0,
            label: "Provider Switch",
            status: "started",
            data: {
              message: `Switching from ${existingProvider} to ${providerPut} — all steps will re-run`,
            },
          });
        } else if (managementRatingBad) {
          await adminClient
            .from("research_checkpoints")
            .delete()
            .eq("ticker_symbol", normalised)
            .in("step_number", [2, 3]);
          const reason = !mr
            ? "missing"
            : !mr.categories
              ? "wrong schema (no categories)"
              : "wrong field names";
          console.log(
            `[${normalised}] management_rating bad (${reason}): cleared Steps 2+3`,
          );
        }
      } catch (cleanupErr) {
        console.warn("[research PUT] checkpoint cleanup failed:", cleanupErr);
      }

      let pipelineResult: PipelineResult;
      try {
        pipelineResult = await runUpdatePipeline(
          normalised,
          prevReport,
          emit,
          providerPut,
        );
      } catch (pipelineErr) {
        const message =
          pipelineErr instanceof Error
            ? pipelineErr.message
            : "Pipeline failed";
        emit({ step: 0, label: "Error", status: "error", data: { message } });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      const { report, diagram, runId } = pipelineResult;
      console.log(
        `[research PUT] UPDATE SYNTHESIS COMPLETE — keys: ${Object.keys(report).join(", ")}`,
      );
      console.log(
        `[research PUT] UPDATE score: ${String(report.score)}, ${typeof report.score}`,
      );
      const rawNewScore = report.score;
      const newScore =
        typeof rawNewScore === "number"
          ? rawNewScore
          : parseFloat(String(rawNewScore ?? "")) || null;
      const newVersion = (existingReport.version ?? 1) + 1;
      console.log(
        `[research PUT] UPDATE — ticker: ${normalised}, new version: ${newVersion}, newScore: ${String(newScore)}, score_type: ${typeof rawNewScore}`,
      );

      const prevScore =
        typeof existingReport.score === "number" ? existingReport.score : null;
      const diff = generateDiff(prevReport, prevScore, report, newScore);

      // Signal save in progress — keeps SSE connection alive during DB write
      emit({ step: 8, label: "Saving Report", status: "saving" });
      console.log(
        `[research PUT] saving report v${newVersion} for ${normalised}...`,
      );

      try {
        const { error: updateErr } = await adminClient
          .from("research_reports")
          .update({
            score: newScore,
            report_json: report as unknown as Json,
            diagram_json: diagram as unknown as Json,
            version: newVersion,
            researched_by: req.user?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingReport.id);

        if (updateErr) {
          console.error(
            "[research PUT] research_reports update failed:",
            JSON.stringify(updateErr),
          );
          emit({
            step: 0,
            label: "Error",
            status: "error",
            data: { message: `Failed to save report: ${updateErr.message}` },
          });
          clearInterval(keepAlive);
          res.end();
          return;
        }

        console.log(`[research PUT] INSERTING version: ${newVersion}`);
        const { error: versionsErr } = await adminClient
          .from("research_versions")
          .insert({
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
          console.error(
            "[research PUT] research_versions insert failed:",
            JSON.stringify(versionsErr),
          );
          emit({
            step: 0,
            label: "Error",
            status: "error",
            data: { message: `Failed to save version: ${versionsErr.message}` },
          });
          clearInterval(keepAlive);
          res.end();
          return;
        }

        // Verify the save landed correctly
        const { data: saved, error: verifyErr } = await adminClient
          .from("research_reports")
          .select("version, score, updated_at")
          .eq("ticker_symbol", normalised)
          .single();
        if (verifyErr) {
          console.error(
            "[research PUT] VERIFY READ FAILED:",
            JSON.stringify(verifyErr),
          );
        } else {
          console.log("[research PUT] CONFIRMED SAVED:", saved);
        }
      } catch (saveErr) {
        console.error("[research PUT] SAVE EXCEPTION:", saveErr);
        emit({
          step: 0,
          label: "Error",
          status: "error",
          data: { message: `Save exception: ${String(saveErr)}` },
        });
        clearInterval(keepAlive);
        res.end();
        return;
      }

      await adminClient
        .from("tickers")
        .update({ last_researched_at: new Date().toISOString() })
        .eq("id", existingReport.ticker_id);

      console.log(
        `[research PUT] report saved — v${newVersion}, ticker: ${normalised}`,
      );
      void clearCheckpoints(normalised, runId);
      clearInterval(keepAlive);
      emit({
        step: 8,
        label: "Saved",
        status: "complete",
        data: { version: newVersion, diff_summary: diff.summary },
      });
      res.end();
    } catch {
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Internal server error", code: "INTERNAL_ERROR" });
      } else {
        res.end();
      }
    }
  },
);

// ─── DELETE /api/v1/research/:ticker ─────────────────────────────────────────

router.delete(
  "/:ticker",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const ticker = getTickerParam(req.params.ticker).toUpperCase();

    const { valid, normalised } = validateTicker(ticker);
    if (!valid) {
      res
        .status(400)
        .json({ error: "Invalid ticker symbol", code: "INVALID_TICKER" });
      return;
    }

    try {
      await adminClient
        .from("research_checkpoints")
        .delete()
        .eq("ticker_symbol", normalised);

      await adminClient
        .from("research_versions")
        .delete()
        .eq("ticker_symbol", normalised);

      const { error } = await adminClient
        .from("research_reports")
        .delete()
        .eq("ticker_symbol", normalised);

      if (error) {
        res
          .status(500)
          .json({ error: "Delete failed", details: error.message });
        return;
      }

      console.log(`[DELETE] ${normalised} removed from database`);
      res.json({
        success: true,
        message: `${normalised} deleted successfully`,
      });
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).json({ error: "Delete failed", details: String(err) });
    }
  },
);

export default router;
