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

export interface PriceScenario {
  label: "Bear" | "Base" | "Bull";
  comp_ticker: string;
  comp_multiple: number;
  target_price: number;
  upside_percent: number;
  rationale: string;
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

export interface ConstraintAnalysis {
  type: string;
  controls_constraint: boolean;
  durability: string;
  value_chain_position: string;
  rent_capture: string;
  investable: boolean;
  who_relieves: string;
  window: string;
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
  score?: number;
  pipeline_steps_raw: Record<string, unknown>;
  quarterly_results?: QuarterlyResult[];
  // v2 fields — absent in reports generated before this version
  scenarios?: PriceScenario[];
  platform_optionality?: string;
  rerating_catalyst?: string;
  bear_case_rebuttal?: string;
  // v0.2.1 fields — absent in reports generated before this version
  constraint_analysis?: ConstraintAnalysis;
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
  status: "started" | "complete" | "error" | "cached" | "saving";
  duration?: number;
  resumed?: boolean;
  data?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "approved" | "pending" | "rejected";
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
  diagram_json: DiagramJson | null;
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
  diagram_json: DiagramJson | null;
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
