import type { SSEEvent } from '../types/report.types';

export function usePipeline() {
  return {
    events: [] as SSEEvent[],
    start: (_ticker: string, _method: 'POST' | 'PUT') => {},
  };
}
