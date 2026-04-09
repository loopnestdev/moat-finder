export interface QuarterlyResult {
  quarter: string;
  revenue_est: number | null;
  revenue_act: number | null;
  revenue_growth: number | null;
  eps_est: number | null;
  eps_act: number | null;
}

export interface Competitor {
  ticker: string;
  name: string;
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
  type: 'revenue' | 'customer' | 'moat' | 'business_unit' | 'risk';
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
  score: { from: number; to: number } | null;
  changed_fields: string[];
  added_catalysts: string[];
  removed_catalysts: string[];
  summary: string;
}

// ─── Pipeline types ──────────────────────────────────────────────────────────

export type AuditAction =
  | 'research_triggered'
  | 'research_updated'
  | 'report_viewed'
  | 'report_searched'
  | 'user_approved'
  | 'user_rejected'
  | 'login'
  | 'logout';

export interface SSEEvent {
  step: number;
  label: string;
  status: 'complete' | 'error';
  data?: Record<string, unknown>;
}

export type EmitFn = (event: SSEEvent) => void;

export interface PipelineResult {
  report: ReportJson;
  diagram: DiagramJson;
}

export interface Step1Output {
  company_name: string;
  industry: string;
  sector: string;
  competitors: Competitor[];
  customers: string[];
  primary_product: string;
  primary_region: string;
}

export interface Step2Output {
  business_model: string;
  moat: string;
  technological_advantage: string;
  catalysts: string[];
}

export interface Step3Output {
  valuation_table: ValuationRow[];
  napkin_math: NapkinMath;
  financial_summary: string;
  quarterly_results?: QuarterlyResult[];
}

export interface Step4Output {
  bear_case: string;
  risk_factors: string[];
  tail_risks: string[];
}

export interface Step5Output {
  macro_summary: string;
  sector_heat: number;
  hot_sector_match: string[];
  tariff_exposure: string;
}

export interface Step6Output {
  sentiment_summary: string;
  short_interest: string;
  ma_position: string;
  rs_vs_spy: string;
}

export interface PipelineContext {
  step1: Step1Output;
  step2: Step2Output;
  step3: Step3Output;
  step4: Step4Output;
  step5: Step5Output;
  step6: Step6Output;
}
