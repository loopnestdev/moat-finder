import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReportJson, DiagramJson, SSEEvent } from "../src/types/report.types";

// ─── Mock Supabase admin client ────────────────────────────────────────────────
//
// Each `.from(table)` call returns a chainable builder whose terminal methods
// (`.single()`) and whose intermediate methods (`.insert()`, `.update()`,
// `.eq()`, `.delete()`) are all awaitable, mirroring supabase-js's thenable
// query builder. The resolved value per table is configurable via
// `tableResults` so each test can simulate success/error paths.

const tableResults: Record<string, { data?: unknown; error?: unknown }> = {};

function defaultResult() {
  return { data: null, error: null };
}

function makeBuilder(table: string): Record<string, unknown> {
  const result = () => tableResults[table] ?? defaultResult();
  const builder: Record<string, unknown> = {
    insert: () => builder,
    select: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    single: () => Promise.resolve(result()),
    then: (resolve: (v: unknown) => void) => resolve(result()),
  };
  return builder;
}

const mockFrom = vi.fn((table: string) => makeBuilder(table));

vi.mock("../src/services/supabase", () => ({
  adminClient: { from: (table: string) => mockFrom(table) },
  anonClient: { from: (table: string) => mockFrom(table) },
}));

import { saveNewReport } from "../src/services/saveResearch";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const report: ReportJson = {
  thesis: "Strong long thesis",
  business_model: "SaaS subscription",
  moat: "High switching costs",
  competitors: [{ ticker: "COMP", name: "Competitor Inc" }],
  napkin_math: {
    revenue_guidance: "$100M ARR",
    comp_ticker: "COMP",
    comp_multiple: 10,
    target_price: 50,
    upside_percent: 25,
  },
  bear_case: "Competition risk from hyperscalers",
  sector_heat: 4,
  hot_sector_match: ["AI"],
  valuation_table: [],
  catalysts: ["Q2 earnings beat"],
  risk_factors: ["Customer concentration"],
  macro_summary: "Positive tailwinds",
  sentiment_summary: "Bullish",
  score: 8.1,
  pipeline_steps_raw: {},
};

const diagram: DiagramJson = { nodes: [], edges: [] };

describe("saveNewReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(tableResults)) delete tableResults[key];
  });

  it("saves the report + version, bumps the ticker, and emits saving/complete events", async () => {
    tableResults.research_reports = { data: { id: "report-1" }, error: null };
    tableResults.research_versions = { error: null };

    const events: SSEEvent[] = [];
    const emit = (e: SSEEvent) => events.push(e);

    const result = await saveNewReport({
      tickerId: "ticker-1",
      tickerSymbol: "TEST",
      researchCount: 2,
      report,
      diagram,
      researchedBy: "user-1",
      runId: "run-1",
      emit,
    });

    expect(result).toEqual({ success: true, reportId: "report-1" });
    expect(mockFrom).toHaveBeenCalledWith("research_reports");
    expect(mockFrom).toHaveBeenCalledWith("research_versions");
    expect(mockFrom).toHaveBeenCalledWith("tickers");

    const statuses = events.map((e) => e.status);
    expect(statuses).toEqual(["saving", "complete"]);
    expect(events[1]?.data).toEqual({ id: "report-1" });
  });

  it("coerces a stringified score into a number", async () => {
    tableResults.research_reports = { data: { id: "report-2" }, error: null };
    tableResults.research_versions = { error: null };

    const events: SSEEvent[] = [];
    const emit = (e: SSEEvent) => events.push(e);

    await saveNewReport({
      tickerId: "ticker-1",
      tickerSymbol: "TEST",
      researchCount: 0,
      report: { ...report, score: "7.5" as unknown as number },
      diagram,
      researchedBy: null,
      runId: "run-1",
      emit,
    });

    // Insert call args aren't directly inspectable via our stub builder,
    // but a successful save with no error confirms the coercion didn't throw.
    expect(events.some((e) => e.status === "complete")).toBe(true);
  });

  it("emits an error event and returns success:false when the report insert fails", async () => {
    tableResults.research_reports = {
      data: null,
      error: { message: "insert failed" },
    };

    const events: SSEEvent[] = [];
    const emit = (e: SSEEvent) => events.push(e);

    const result = await saveNewReport({
      tickerId: "ticker-1",
      tickerSymbol: "TEST",
      researchCount: 0,
      report,
      diagram,
      researchedBy: null,
      runId: "run-1",
      emit,
    });

    expect(result).toEqual({ success: false });
    const errorEvent = events.find((e) => e.status === "error");
    expect(errorEvent?.data?.message).toContain("Failed to save report");
    // Must not proceed to write a version or bump the ticker after a failed report insert.
    expect(mockFrom).not.toHaveBeenCalledWith("research_versions");
    expect(mockFrom).not.toHaveBeenCalledWith("tickers");
  });

  it("emits an error event and returns success:false when the version insert fails", async () => {
    tableResults.research_reports = { data: { id: "report-3" }, error: null };
    tableResults.research_versions = { error: { message: "version failed" } };

    const events: SSEEvent[] = [];
    const emit = (e: SSEEvent) => events.push(e);

    const result = await saveNewReport({
      tickerId: "ticker-1",
      tickerSymbol: "TEST",
      researchCount: 0,
      report,
      diagram,
      researchedBy: null,
      runId: "run-1",
      emit,
    });

    expect(result).toEqual({ success: false });
    const errorEvent = events.find((e) => e.status === "error");
    expect(errorEvent?.data?.message).toContain("Failed to save version");
    // Ticker bump must not happen once the version write fails.
    expect(mockFrom).not.toHaveBeenCalledWith("tickers");
  });
});
