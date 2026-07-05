import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../lib/api";
import type {
  ResearchListItem,
  ResearchReport,
  ResearchVersion,
} from "../types/report.types";

export interface ResearchListFilters {
  minScore?: number | null;
  minUpside?: number | null;
  minYoy?: number | null;
  sector?: string;
  minSectorHeat?: number | null;
  sortBy?: "date" | "score" | "upside";
}

export interface ResearchListPage {
  data: ResearchListItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function buildListQueryString(
  filters: ResearchListFilters,
  page: number,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (filters.minScore != null) params.set("minScore", String(filters.minScore));
  if (filters.minUpside != null)
    params.set("minUpside", String(filters.minUpside));
  if (filters.minYoy != null) params.set("minYoy", String(filters.minYoy));
  if (filters.minSectorHeat != null)
    params.set("minSectorHeat", String(filters.minSectorHeat));
  if (filters.sector) params.set("sector", filters.sector);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  return params.toString();
}

/** Server-paginated + server-filtered research list, for the home page grid. */
export function useReportList(filters: ResearchListFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["research", filters],
    queryFn: async ({ pageParam }) => {
      const qs = buildListQueryString(filters, pageParam);
      const res = await apiFetch(`/api/v1/research?${qs}`);
      return (await res.json()) as ResearchListPage;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
  });
}

/** Distinct sector tags across all reports, for the Sector filter dropdown. */
export function useSectorOptions() {
  return useQuery({
    queryKey: ["research", "sectors"],
    queryFn: async () => {
      const res = await apiFetch("/api/v1/research/sectors");
      return ((await res.json()) as { data: string[] }).data;
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function useReport(ticker: string, enabled = true) {
  return useQuery({
    queryKey: ["research", ticker],
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
    queryKey: ["research", ticker, "versions"],
    queryFn: async () => {
      const res = await apiFetch(`/api/v1/research/${ticker}/versions`);
      return ((await res.json()) as { data: ResearchVersion[] }).data;
    },
    enabled: ticker.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
