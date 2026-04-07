export interface NapkinMath {
  revenue_guidance: string;
  comp_ticker: string;
  comp_multiple: number;
  target_price: number;
  upside_percent: number;
}

export interface ValuationRow {
  ticker: string;
  name: string;
  ps_ratio: number | null;
  ev_ebitda: number | null;
  gross_margin: number | null;
  yoy_growth: number | null;
}

export interface Competitor {
  ticker: string;
  name: string;
}

export interface ReportJson {
  thesis: string;
  business_model: string;
  moat: string;
  competitors: Competitor[];
  napkin_math: NapkinMath;
  bear_case: string;
  sector_heat: number;
  hot_sector_match: string[];
  valuation_table: ValuationRow[];
  catalysts: string[];
  macro_summary: string;
  sentiment_summary: string;
  pipeline_steps_raw: Record<string, unknown>;
}

export interface DiagramNode {
  id: string;
  type: string;
  data: { label: string; detail?: string };
  position: { x: number; y: number };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DiagramJson {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface DiffJson {
  score: { from: number | null; to: number | null } | null;
  changed_fields: string[];
  added_catalysts: string[];
  removed_catalysts: string[];
  summary: string;
}

export interface SSEEvent {
  step: number;
  label: string;
  status: 'complete' | 'error';
  data?: Record<string, unknown>;
}
