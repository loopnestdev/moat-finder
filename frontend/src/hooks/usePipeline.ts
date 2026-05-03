import { useCallback, useEffect, useRef, useState } from "react";
import { streamSSE } from "../lib/api";
import type { SSEEvent } from "../types/report.types";

export interface PendingConfirm {
  runId: string;
  company_name: string;
  ticker: string;
  message: string;
}

type ConfirmResult = { confirmed: boolean; correction?: string };

export function usePipeline() {
  const [steps, setSteps] = useState<SSEEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null,
  );

  const abortRef = useRef<AbortController | null>(null);
  const confirmResolverRef = useRef<((r: ConfirmResult) => void) | null>(null);

  const startResearch = useCallback(
    async (ticker: string, provider?: string): Promise<SSEEvent[]> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setSteps([]);
      setError(null);
      setIsComplete(false);
      setIsRunning(true);
      setIsStarting(false);
      setPendingConfirm(null);

      let collected: SSEEvent[] = [];
      let correction: string | undefined = undefined;
      let runId: string | null = null;

      try {
        // Phase 1: discover — loops if user provides a correction
        while (true) {
          let confirmReceived = false;
          let pendingRunId: string | null = null;
          let pendingCompanyName: string | null = null;

          for await (const event of streamSSE(
            `/api/v1/research/${ticker}/discover`,
            {
              provider: provider ?? "claude",
              ...(correction !== undefined ? { correction } : {}),
            },
            ctrl.signal,
          )) {
            if (event.status === "confirm_required") {
              confirmReceived = true;
              const d = event.data as
                | { runId?: string; company_name?: string; ticker?: string }
                | undefined;
              pendingRunId = d?.runId ?? null;
              pendingCompanyName = d?.company_name ?? null;
              if (pendingRunId && pendingCompanyName) {
                setPendingConfirm({
                  runId: pendingRunId,
                  company_name: pendingCompanyName,
                  ticker: d?.ticker ?? ticker,
                  message: `Found: ${pendingCompanyName} (${d?.ticker ?? ticker}). Is this correct?`,
                });
              }
              continue;
            }
            if (event.status === "error") {
              setError(
                (event.data?.message as string | undefined) ??
                  "Discovery failed",
              );
              setIsRunning(false);
              return collected;
            }
            collected.push(event);
            setSteps((prev) => [...prev, event]);
          }

          if (!confirmReceived) break;

          // Wait for the user to confirm or provide a correction
          const confirmResult = await new Promise<ConfirmResult>(
            (resolve, reject) => {
              confirmResolverRef.current = resolve;
              ctrl.signal.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            },
          );

          if (confirmResult.confirmed) {
            runId = pendingRunId;
            break;
          } else if (confirmResult.correction) {
            correction = confirmResult.correction;
            // Clear old Step 1 events before re-running discover
            setSteps((prev) => prev.filter((e) => e.step !== 1));
            collected = collected.filter((e) => e.step !== 1);
            // continue loop — re-runs /discover with correction
          } else {
            // User rejected without a correction — stop
            setIsRunning(false);
            return collected;
          }
        }

        if (!runId) {
          setIsRunning(false);
          return collected;
        }

        // Phase 2: run Steps 2–7 from the checkpoint
        setIsStarting(true);
        setPendingConfirm(null);

        for await (const event of streamSSE(
          `/api/v1/research/${ticker}/run`,
          { provider: provider ?? "claude", runId },
          ctrl.signal,
        )) {
          if (event.status === "started" && event.step >= 2) {
            setIsStarting(false);
          }
          if (event.status === "error") {
            setError(
              (event.data?.message as string | undefined) ?? "Pipeline failed",
            );
            break;
          }
          collected.push(event);
          setSteps((prev) => [...prev, event]);
          if (event.step === 8) {
            setIsComplete(true);
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        setIsRunning(false);
        setIsStarting(false);
      }

      return collected;
    },
    [],
  );

  const updateResearch = useCallback(
    async (ticker: string, provider?: string): Promise<SSEEvent[]> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setSteps([]);
      setError(null);
      setIsComplete(false);
      setIsRunning(true);
      setIsStarting(false);
      setPendingConfirm(null);

      const collected: SSEEvent[] = [];

      try {
        for await (const event of streamSSE(
          `/api/v1/research/${ticker}`,
          { provider: provider ?? "claude" },
          ctrl.signal,
          "PUT",
        )) {
          if (event.status === "error") {
            setError(
              (event.data?.message as string | undefined) ?? "Update failed",
            );
            break;
          }
          collected.push(event);
          setSteps((prev) => [...prev, event]);
          if (event.step === 8) {
            setIsComplete(true);
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        setIsRunning(false);
        setIsStarting(false);
      }

      return collected;
    },
    [],
  );

  const sendConfirmation = useCallback(
    (confirmed: boolean, correction?: string) => {
      if (!pendingConfirm) return;
      setPendingConfirm(null);
      if (confirmed) setIsStarting(true);
      if (confirmResolverRef.current) {
        confirmResolverRef.current({ confirmed, correction });
        confirmResolverRef.current = null;
      }
    },
    [pendingConfirm],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (confirmResolverRef.current) {
        confirmResolverRef.current({ confirmed: false });
        confirmResolverRef.current = null;
      }
    };
  }, []);

  return {
    steps,
    isRunning,
    isStarting,
    error,
    isComplete,
    startResearch,
    updateResearch,
    pendingConfirm,
    sendConfirmation,
  };
}
