export interface ConfirmationResult {
  confirmed: boolean;
  correction?: string;
}

const pending = new Map<string, (result: ConfirmationResult) => void>();

/**
 * Register a pending confirmation for a pipeline run.
 * The returned Promise resolves when resolveConfirmation() is called,
 * or auto-resolves confirmed=true after timeoutMs (prevents hung pipelines).
 */
export function registerConfirmation(
  runId: string,
  timeoutMs = 60_000,
): Promise<ConfirmationResult> {
  return new Promise((resolve) => {
    pending.set(runId, resolve);
    setTimeout(() => {
      if (pending.has(runId)) {
        pending.delete(runId);
        resolve({ confirmed: true });
      }
    }, timeoutMs);
  });
}

/**
 * Called by the POST /confirm route to unblock a waiting pipeline.
 * Returns false if no pipeline is waiting for this runId.
 */
export function resolveConfirmation(
  runId: string,
  result: ConfirmationResult,
): boolean {
  const resolver = pending.get(runId);
  if (!resolver) return false;
  pending.delete(runId);
  resolver(result);
  return true;
}
