export interface QuarterlyResult {
  quarter: string;
  revenue_est: number | null;
  revenue_act: number | null;
  revenue_growth: number | null;
  eps_est: number | null;
  eps_act: number | null;
}

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
  risk_factors: string[];
  macro_summary: string;
  sentiment_summary: string;
  pipeline_steps_raw: Record<string, unknown>;
  quarterly_results?: QuarterlyResult[];
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
  status: 'complete' | 'error' | 'cached';
  data?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'approved' | 'pending' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Ticker {
  id: string;
  symbol: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  first_researched_at: string;
  last_researched_at: string;
  research_count: number;
}

export interface ResearchReport {
  id: string;
  ticker_id: string;
  ticker_symbol: string;
  score: number | null;
  report_json: ReportJson;
  diagram_json: DiagramJson;
  version: number;
  researched_by: string | null;
  created_at: string;
  updated_at: string;
  tickers?: Ticker;
}

export interface ResearchVersion {
  id: string;
  ticker_id: string;
  ticker_symbol: string;
  version: number;
  score: number | null;
  report_json: ReportJson;
  diagram_json: DiagramJson;
  diff_json: DiffJson | null;
  researched_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  ticker_symbol: string | null;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
