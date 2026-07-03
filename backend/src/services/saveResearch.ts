import { adminClient } from "./supabase";
import { clearCheckpoints } from "./checkpoint";
import type { EmitFn, ReportJson, DiagramJson } from "../types/report.types";
import type { Json } from "../types/database.types";

export interface SaveNewReportParams {
  tickerId: string;
  tickerSymbol: string;
  researchCount: number;
  report: ReportJson;
  diagram: DiagramJson;
  researchedBy: string | null;
  runId: string;
  emit: EmitFn;
}

export interface SaveNewReportResult {
  success: boolean;
  reportId?: string;
}

/**
 * Saves a freshly generated (version 1) report: inserts research_reports +
 * research_versions, bumps the ticker's research_count, clears the run's
 * checkpoints, and emits the "saving"/"complete"/"error" SSE events.
 * Shared by POST /:ticker (single-phase) and POST /:ticker/run (two-phase).
 */
export async function saveNewReport(
  params: SaveNewReportParams,
): Promise<SaveNewReportResult> {
  const {
    tickerId,
    tickerSymbol,
    researchCount,
    report,
    diagram,
    researchedBy,
    runId,
    emit,
  } = params;

  const rawScore = report.score;
  const score =
    typeof rawScore === "number"
      ? rawScore
      : parseFloat(String(rawScore ?? "")) || null;

  emit({ step: 8, label: "Saving Report", status: "saving" });

  const { data: savedReport, error: reportErr } = await adminClient
    .from("research_reports")
    .insert({
      ticker_id: tickerId,
      ticker_symbol: tickerSymbol,
      score,
      report_json: report as unknown as Json,
      diagram_json: diagram as unknown as Json,
      version: 1,
      researched_by: researchedBy,
    })
    .select("id")
    .single();

  if (reportErr || !savedReport) {
    console.error(
      "[saveNewReport] research_reports insert failed:",
      reportErr ? JSON.stringify(reportErr) : "no data returned",
    );
    emit({
      step: 0,
      label: "Error",
      status: "error",
      data: {
        message: reportErr
          ? `Failed to save report: ${reportErr.message}`
          : "Failed to save report: no data returned",
      },
    });
    return { success: false };
  }

  const { error: versionsErr } = await adminClient
    .from("research_versions")
    .insert({
      ticker_id: tickerId,
      ticker_symbol: tickerSymbol,
      version: 1,
      score,
      report_json: report as unknown as Json,
      diagram_json: diagram as unknown as Json,
      diff_json: null,
      researched_by: researchedBy,
    });

  if (versionsErr) {
    console.error(
      "[saveNewReport] research_versions insert failed:",
      JSON.stringify(versionsErr),
    );
    emit({
      step: 0,
      label: "Error",
      status: "error",
      data: { message: `Failed to save version: ${versionsErr.message}` },
    });
    return { success: false };
  }

  await adminClient
    .from("tickers")
    .update({
      research_count: researchCount + 1,
      last_researched_at: new Date().toISOString(),
    })
    .eq("id", tickerId);

  console.log(
    `[saveNewReport] report saved — id: ${savedReport.id}, ticker: ${tickerSymbol}`,
  );
  void clearCheckpoints(tickerSymbol, runId);
  emit({
    step: 8,
    label: "Saved",
    status: "complete",
    data: { id: savedReport.id },
  });

  return { success: true, reportId: savedReport.id };
}
