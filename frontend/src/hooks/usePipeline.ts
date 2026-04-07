import { useCallback, useEffect, useRef, useState } from 'react';
import { streamResearch } from '../lib/api';
import type { SSEEvent } from '../types/report.types';

export function usePipeline() {
  const [steps, setSteps] = useState<SSEEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (ticker: string, method: 'POST' | 'PUT'): Promise<SSEEvent[]> => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setSteps([]);
      setError(null);
      setIsComplete(false);
      setIsRunning(true);

      const collected: SSEEvent[] = [];

      try {
        for await (const event of streamResearch(ticker, method, ctrl.signal)) {
          collected.push(event);
          setSteps((prev) => [...prev, event]);
          if (event.step === 8) {
            setIsComplete(true);
            setIsRunning(false);
          }
          if (event.status === 'error') {
            setError(
              (event.data?.message as string | undefined) ?? 'Pipeline failed',
            );
            setIsRunning(false);
            break;
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsRunning(false);
        }
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
    (ticker: string): Promise<SSEEvent[]> => start(ticker, 'POST'),
    [start],
  );

  const updateResearch = useCallback(
    (ticker: string): Promise<SSEEvent[]> => start(ticker, 'PUT'),
    [start],
  );

  return { steps, isRunning, error, isComplete, startResearch, updateResearch };
}
