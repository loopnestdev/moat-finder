import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ResearchReport, ResearchVersion } from '../types/report.types';

export function useReportList() {
  return useQuery({
    queryKey: ['research'],
    queryFn: async () => {
      const res = await apiFetch('/api/v1/research');
      return ((await res.json()) as { data: ResearchReport[] }).data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useReport(ticker: string, enabled = true) {
  return useQuery({
    queryKey: ['research', ticker],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/research/${ticker}`);
      return ((await res.json()) as { data: ResearchReport }).data;
    },
    enabled: enabled && ticker.length > 0,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
}

export function useVersions(ticker: string) {
  return useQuery({
    queryKey: ['research', ticker, 'versions'],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/research/${ticker}/versions`);
      return ((await res.json()) as { data: ResearchVersion[] }).data;
    },
    enabled: ticker.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
