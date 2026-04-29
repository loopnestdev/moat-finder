import { adminClient } from "./supabase";

export interface StepCheckpoint {
  step_number: number;
  step_label: string;
  output_json: Record<string, unknown>;
  tokens_used?: number;
  duration_ms?: number;
}

/**
 * Save a completed step immediately to research_checkpoints.
 * Checkpoint failures are logged but never propagate — they must not stop the pipeline.
 */
export async function saveCheckpoint(
  tickerSymbol: string,
  runId: string,
  step: StepCheckpoint,
): Promise<void> {
  const { error } = await adminClient.from("research_checkpoints").upsert(
    {
      ticker_symbol: tickerSymbol,
      run_id: runId,
      step_number: step.step_number,
      step_label: step.step_label,
      status: "complete",
      output_json: step.output_json as import("../types/database.types").Json,
      tokens_used: step.tokens_used ?? null,
      duration_ms: step.duration_ms ?? null,
    },
    { onConflict: "ticker_symbol,run_id,step_number" },
  );

  if (error) {
    console.error("CHECKPOINT SAVE FAILED:", {
      table: "research_checkpoints",
      ticker: tickerSymbol,
      step: step.step_number,
      error: JSON.stringify(error),
      hint: "Check if table exists and service role has INSERT permission",
    });
  } else {
    console.log(
      `[checkpoint] Saved step ${step.step_number} (${step.step_label}) for ${tickerSymbol} run ${runId}`,
    );
  }
}

/**
 * Load the most recent in-progress run for a ticker.
 * Returns the runId and a Map of step_number → output for all completed steps in that run.
 * Returns null if no checkpoints exist.
 */
export async function loadCheckpoints(
  tickerSymbol: string,
): Promise<{
  runId: string;
  steps: Map<number, Record<string, unknown>>;
} | null> {
  // Find the most recent run_id that has at least one complete checkpoint
  const { data: latestRun, error: runErr } = await adminClient
    .from("research_checkpoints")
    .select("run_id, created_at")
    .eq("ticker_symbol", tickerSymbol)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1);

  if (runErr) {
    console.error("[checkpoint] Failed to query latest run:", runErr.message);
    return null;
  }
  if (!latestRun || latestRun.length === 0) return null;

  const runId = latestRun[0].run_id;

  // Load all completed steps from that run
  const { data: checkpoints, error: stepsErr } = await adminClient
    .from("research_checkpoints")
    .select("step_number, output_json")
    .eq("ticker_symbol", tickerSymbol)
    .eq("run_id", runId)
    .eq("status", "complete");

  if (stepsErr) {
    console.error("[checkpoint] Failed to load steps:", stepsErr.message);
    return null;
  }
  if (!checkpoints || checkpoints.length === 0) return null;

  const steps = new Map<number, Record<string, unknown>>();
  for (const cp of checkpoints) {
    steps.set(cp.step_number, cp.output_json as Record<string, unknown>);
  }

  console.log(
    `[checkpoint] Resuming ${tickerSymbol} run ${runId} — completed steps: ${[...steps.keys()].sort((a, b) => a - b).join(", ")}`,
  );

  return { runId, steps };
}

/**
 * Delete a single step checkpoint. Used to force a step re-run when a cached
 * checkpoint is missing required fields (e.g. Step 2 missing management_rating).
 */
export async function deleteStepCheckpoint(
  tickerSymbol: string,
  runId: string,
  stepNumber: number,
): Promise<void> {
  const { error } = await adminClient
    .from("research_checkpoints")
    .delete()
    .eq("ticker_symbol", tickerSymbol)
    .eq("run_id", runId)
    .eq("step_number", stepNumber);

  if (error) {
    console.error(
      `[checkpoint] Failed to delete step ${stepNumber} for ${tickerSymbol}:`,
      error.message,
    );
  } else {
    console.log(
      `[checkpoint] Deleted step ${stepNumber} checkpoint for ${tickerSymbol} run ${runId}`,
    );
  }
}

/**
 * Delete all checkpoints for a given run after the pipeline completes successfully.
 * Called only after the final report has been saved to Supabase.
 */
export async function clearCheckpoints(
  tickerSymbol: string,
  runId: string,
): Promise<void> {
  const { error } = await adminClient
    .from("research_checkpoints")
    .delete()
    .eq("ticker_symbol", tickerSymbol)
    .eq("run_id", runId);

  if (error) {
    console.error(
      `[checkpoint] Failed to clear checkpoints for ${tickerSymbol} run ${runId}:`,
      error.message,
    );
  } else {
    console.log(
      `[checkpoint] Cleared checkpoints for ${tickerSymbol} run ${runId}`,
    );
  }
}
