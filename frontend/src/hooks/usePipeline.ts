import { useCallback, useEffect, useRef, useState } from "react";
import { streamResearch, confirmResearch } from "../lib/api";
import type { SSEEvent } from "../types/report.types";

export interface PendingConfirm {
  runId: string;
  company_name: string;
  ticker: string;
  message: string;
}

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
  const currentTickerRef = useRef<string>("");

  const start = useCallback(
    async (
      ticker: string,
      method: "POST" | "PUT",
      provider?: string,
    ): Promise<SSEEvent[]> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      currentTickerRef.current = ticker;
      setSteps([]);
      setError(null);
      setIsComplete(false);
      setIsRunning(true);
      setIsStarting(false);
      setPendingConfirm(null);

      const collected: SSEEvent[] = [];

      try {
        for await (const event of streamResearch(
          ticker,
          method,
          ctrl.signal,
          provider,
        )) {
          if (event.status === "confirm_required") {
            const d = event.data as
              | {
                  runId?: string;
                  company_name?: string;
                  ticker?: string;
                  message?: string;
                }
              | undefined;
            if (d?.runId && d.company_name) {
              setPendingConfirm({
                runId: d.runId,
                company_name: d.company_name,
                ticker: d.ticker ?? ticker,
                message:
                  d.message ??
                  `Found: ${d.company_name} (${ticker}). Is this correct?`,
              });
            }
            continue; // not a pipeline step — don't add to steps list
          }

          collected.push(event);
          setSteps((prev) => [...prev, event]);

          // Clear pendingConfirm and isStarting once the pipeline resumes (Steps 2+ start)
          if (event.status === "started" && event.step >= 2) {
            setPendingConfirm(null);
            setIsStarting(false);
          }

          if (event.step === 8) {
            setIsComplete(true);
          }
          if (event.status === "error") {
            setError(
              (event.data?.message as string | undefined) ?? "Pipeline failed",
            );
            break;
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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startResearch = useCallback(
    (ticker: string, provider?: string): Promise<SSEEvent[]> =>
      start(ticker, "POST", provider),
    [start],
  );

  const updateResearch = useCallback(
    (ticker: string, provider?: string): Promise<SSEEvent[]> =>
      start(ticker, "PUT", provider),
    [start],
  );

  const sendConfirmation = useCallback(
    (confirmed: boolean, correction?: string) => {
      if (!pendingConfirm) return;
      // Optimistically clear — backend will re-emit confirm_required if retry needed
      setPendingConfirm(null);
      setIsStarting(true);
      // Fire-and-forget: SSE stream is already open and delivers events independently
      confirmResearch(
        currentTickerRef.current,
        pendingConfirm.runId,
        confirmed,
        correction,
      ).catch((err: unknown) => {
        console.error("Confirm failed:", err);
        setError("Failed to confirm — please try again");
      });
    },
    [pendingConfirm],
  );

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
