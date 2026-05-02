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

export interface ConstraintAnalysis {
  /** 'supply_chain' | 'technology' | 'regulatory' | 'capital' | 'none' */
  type: string;
  /** Does the company own/control the scarce resource, process, or IP? */
  controls_constraint: boolean;
  /** 'durable' | 'temporary' | 'solvable_by_capital' */
  durability: string;
  /** Where in the value chain does the company sit? */
  value_chain_position: string;
  /** Can they actually capture the rent, or does value accrue elsewhere? */
  rent_capture: string;
  /** Is this an investable bottleneck? */
  investable: boolean;
  /** Who has the power/incentive to relieve it, and what sits outside their control? */
  who_relieves: string;
  /** How long before consensus prices it in? */
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
  /** Weighted investment score 1.0–10.0 from Step 7 scoring rubric. Optional for backwards-compat with pre-score reports. */
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
  // v0.3.0 fields — multi-LLM support
  llm_provider?: string;
  llm_model?: string;
  // v0.5.2 — independent management assessment, never factored into investment score
  management_rating?: ManagementRating;
}

export interface DiagramNode {
  id: string;
  type: "revenue" | "customer" | "moat" | "business_unit" | "risk";
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
  target_price: {
    from: number | null;
    to: number | null;
    upside_from: number | null;
    upside_to: number | null;
  } | null;
  changed_fields: string[];
  added_catalysts: string[];
  removed_catalysts: string[];
  summary: string;
}

// ─── Pipeline types ──────────────────────────────────────────────────────────

export type AuditAction =
  | "research_triggered"
  | "research_updated"
  | "report_viewed"
  | "report_searched"
  | "user_approved"
  | "user_rejected"
  | "login"
  | "logout";

export interface SSEEvent {
  step: number;
  label: string;
  status:
    | "started"
    | "complete"
    | "error"
    | "cached"
    | "saving"
    | "confirm_required";
  duration?: number;
  resumed?: boolean;
  data?: Record<string, unknown>;
}

export type EmitFn = (event: SSEEvent) => void;

export interface PipelineResult {
  report: ReportJson;
  diagram: DiagramJson;
  runId: string;
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

export interface ManagementRatingCategory {
  score: number;
  max: number;
  evidence: string;
}

export interface ManagementRating {
  grade: "A" | "B" | "C" | "D" | "F";
  summary?: string;
  // Schema A fields (canonical format enforced since v0.6.2)
  total_score?: number;
  categories?: {
    say_do_ratio?: ManagementRatingCategory;
    communication?: ManagementRatingCategory;
    capital_discipline?: ManagementRatingCategory;
    insider_alignment?: ManagementRatingCategory;
    strategic_focus?: ManagementRatingCategory;
  };
  key_person?: string;
  red_flags?: string[];
  green_flags?: string[];
  // Schema B fields (Gemini legacy format — backward compat only)
  score?: number;
  ceo_assessment?: string;
  recent_changes?: string;
  capital_allocation?: string;
}

export interface Step2Output {
  business_model: string;
  moat: string;
  technological_advantage: string;
  catalysts: string[];
  platform_type?: "platform" | "single-product";
  platform_optionality?: string;
  rerating_catalyst?: string;
  // v0.2.1 — absent in runs before this version
  constraint_analysis?: ConstraintAnalysis;
  // v0.5.2 — independent management assessment, never factored into investment score
  management_rating?: ManagementRating;
}

export interface Step3Output {
  valuation_table: ValuationRow[];
  napkin_math: NapkinMath;
  financial_summary: string;
  quarterly_results?: QuarterlyResult[];
  scenarios?: PriceScenario[];
}

export interface Step4Output {
  bear_case: string;
  risk_factors: string[];
  tail_risks: string[];
  bear_case_rebuttal?: string;
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
