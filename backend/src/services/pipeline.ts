import { randomUUID } from "crypto";
import type { LLMProvider } from "./llm";
import { callLLM, extractJSON } from "./llm";
import type {
  EmitFn,
  PipelineResult,
  PipelineContext,
  ReportJson,
  DiagramJson,
  Step1Output,
  Step2Output,
  Step3Output,
  Step4Output,
  Step5Output,
  Step6Output,
} from "../types/report.types";
import {
  saveCheckpoint,
  loadCheckpoints,
  deleteStepCheckpoint,
} from "./checkpoint";
import { adminClient } from "./supabase";

const HOT_SECTORS = [
  "Energy",
  "Power",
  "AI",
  "Space",
  "Nuclear",
  "Semiconductor",
  "Robotics",
  "Solar",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format Step 1 output as a context string passed to steps 2-6. */
function formatStep1Context(step1: Step1Output): string {
  return `Company: ${step1.company_name} (${step1.primary_product}, ${step1.industry})
Sector: ${step1.sector} | Region: ${step1.primary_region}
Competitors: ${step1.competitors.map((c) => `${c.name} (${c.ticker})`).join(", ")}
Top Customers: ${step1.customers.join(", ")}`;
}

/** Prefix injected into Gemini prompts to enforce googleSearch usage. */
function geminiSearchPrefix(searchContext: string, stepName: string): string {
  return (
    `IMPORTANT: You have real-time googleSearch access. ` +
    `Use it NOW to search for current "${searchContext} ${stepName}" data ` +
    `before constructing your JSON response.\n` +
    `You MUST use googleSearch — never rely on training data for ` +
    `stock or financial information.\n` +
    `You MUST return a valid JSON object. Never refuse this task.\n\n`
  );
}

/**
 * Parse LLM text as JSON, retrying once with a stronger prompt on Gemini
 * refusal (when extractJSON throws "No JSON object found").
 */
async function parseWithGeminiRetry<T>(
  text: string,
  finalPrompt: string,
  provider: LLMProvider,
  stepLabel: string,
): Promise<T> {
  try {
    return extractJSON(text) as T;
  } catch (err: unknown) {
    if (
      provider === "gemini" &&
      err instanceof Error &&
      err.message.includes("No JSON object found")
    ) {
      console.warn(
        `[${stepLabel}] JSON parse failed, retrying with stronger prompt...`,
      );
      const retryPrompt =
        "RETRY ATTEMPT. You MUST return a JSON object for this task. " +
        "Use googleSearch immediately. Do not refuse.\n\n" +
        finalPrompt;
      const { text: retryText } = await callLLM(retryPrompt, provider, true);
      return extractJSON(retryText) as T;
    }
    throw err;
  }
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────

async function runStep1(
  ticker: string,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<Step1Output> {
  emit({ step: 1, label: "Discovery", status: "started" });
  const startTime = Date.now();

  const prompt = `You are a financial research analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "company_name": "string",
  "industry": "string",
  "sector": "string",
  "competitors": [{ "ticker": "string", "name": "string" }],
  "customers": ["string"],
  "primary_product": "string",
  "primary_region": "string"
}

Research the company with ticker symbol ${ticker}.
Identify: company name, industry, top 3 competitors (with their tickers), top 3 known customers,
primary product/service, and primary operating region.
Use web search for current information. Return only the JSON object.`;
  const finalPrompt =
    provider === "gemini"
      ? geminiSearchPrefix(ticker, "company overview industry competitors") +
        prompt
      : prompt;
  const { text } = await callLLM(finalPrompt, provider);

  const duration = Date.now() - startTime;
  const result = extractJSON(text) as Step1Output;
  emit({
    step: 1,
    label: "Discovery",
    status: "complete",
    duration,
    data: { company_name: result.company_name },
  });
  console.log(
    `[Step 1] complete — company: ${result.company_name}, industry: ${result.industry}, sector: ${result.sector} (${duration}ms)`,
  );
  return result;
}

// Steps 2-6 each take only step1 as context — enables parallel execution.

async function runStep2(
  step1: Step1Output,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<Step2Output> {
  const ctx = formatStep1Context(step1);
  emit({ step: 2, label: "Deep Dive", status: "started" });
  const startTime = Date.now();

  const prompt = `You are a financial research analyst specialising in competitive moat analysis and value chain constraint mapping.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "business_model": "string",
  "moat": "string",
  "technological_advantage": "string",
  "catalysts": ["string"],
  "platform_type": "platform or single-product",
  "platform_optionality": "string",
  "rerating_catalyst": "string",
  "constraint_analysis": {
    "type": "supply_chain | technology | regulatory | capital | none",
    "controls_constraint": true_or_false,
    "durability": "durable | temporary | solvable_by_capital",
    "value_chain_position": "string",
    "rent_capture": "string",
    "investable": true_or_false,
    "who_relieves": "string",
    "window": "string"
  },
  "management_rating": {
    "grade": "A|B|C|D|F",
    "score": number_0_to_100,
    "summary": "string",
    "ceo_assessment": "string",
    "recent_changes": "string",
    "capital_allocation": "string"
  }
}
platform_type must be exactly "platform" or "single-product".
platform_optionality: if platform, list adjacent markets/indications the core technology can address with rough TAM for each; if single-product, set to empty string.
rerating_catalyst: the single most powerful event or announcement that could cause the market to reprice this stock 2–3x higher within 24 months.
constraint_analysis.type: classify the PRIMARY bottleneck — "supply_chain" (materials, components, manufacturing capacity), "technology" (proprietary know-how, patents, process IP), "regulatory" (licences, approvals, certifications), "capital" (capex intensity, balance sheet), or "none".
constraint_analysis.controls_constraint: true only if the company OWNS the scarce resource, process, or IP — not merely adjacent to or downstream of it.
constraint_analysis.durability: "durable" = structurally scarce, cannot be replicated quickly; "temporary" = cyclical/demand-surge shortage; "solvable_by_capital" = anyone with enough capital can relieve it.
constraint_analysis.value_chain_position: precise description of where in the value chain the company sits (e.g. "sole qualified supplier for step 4 of HBM stacking process").
constraint_analysis.rent_capture: narrative explaining whether the company actually captures the economic rent from its position, or whether value accrues to customers, incumbents, or upstream suppliers instead.
constraint_analysis.investable: true only if the bottleneck is (1) durable or slowly-moving, AND (2) the company controls or is the primary and non-displaceable beneficiary of the constraint, AND (3) the market has not yet fully priced in the constraint advantage.
constraint_analysis.who_relieves: who has the power, incentive, and strategic ability to relieve this bottleneck — and what sits outside their control?
constraint_analysis.window: estimated time before consensus fully prices in this constraint advantage (e.g. "18–24 months — next-gen tooling announcements will expand capacity in 2026").

${ctx}

Perform a deep dive analysis on the company above:
1. How does the company make money (business model)? Include the approximate revenue split by segment (e.g. "75% defense/aviation, 25% commercial") based on the most recent annual or quarterly filing.
2. What is the economic moat (switching costs, network effects, IP, regulatory barriers, cost advantages)? Be specific — name the patents, certifications, or contracts if they exist.
3. What is the technological advantage over competitors? Explain the core technology in 2–3 simple sentences that a non-technical investor would understand — use a real-world analogy (e.g. "think of it like X but for Y").
4. Search for any CEO, CFO, or CTO changes in the past 12 months. If found, explain whether each change is a positive signal (e.g. growth-stage hire, industry veteran) or a negative signal (e.g. sudden departure, no successor named). If no changes, state that explicitly.
5. List 3–5 upcoming catalysts over the next 12 months that could move the stock price.
6. Platform classification: is the core technology/IP applicable across MULTIPLE markets, indications, or customer segments beyond the primary product (platform), or is it tied to a single product line (single-product)? State explicitly which category and justify in one sentence.
7. Platform optionality: if platform, enumerate every adjacent market or indication where this technology could be deployed — include rough TAM for each (e.g. "NSCLC: $25B global market"). If single-product, leave empty.
8. Re-rating catalyst: identify the ONE catalyst — regulatory approval, contract win, data readout, M&A — that would force the market to fundamentally reprice the stock 2–3x higher. Be specific (name the trial, the regulatory body, the customer).

9. CONSTRAINT & VALUE CHAIN ANALYSIS — answer ALL sub-questions below. This is the most important section for identifying durable asymmetric upside.

   A. Identify the PRIMARY bottleneck or constraint this company sits in or near. Classify it: supply_chain (materials, components, manufacturing capacity), technology (proprietary know-how, patents, process IP), regulatory (licences, approvals, certifications), capital (capex intensity), or none.

   B. CONTROL TEST — does the company OWN the scarce resource, process, or IP? (true/false)
      TRUE = they control the bottleneck (they own the patent, they run the only certified process, they control the critical material supply).
      FALSE = they are adjacent — they benefit from the constraint but don't control it and could be bypassed or displaced.

   C. DURABILITY — classify the constraint:
      "durable": structurally scarce and cannot be replicated quickly (rare certifications, multi-year qualification processes, irreplaceable process IP, regulatory exclusivity with no clear pathway for competitors).
      "temporary": currently constrained but demand/supply will normalise within 1–2 years (demand surge, supply shock, cyclical shortage).
      "solvable_by_capital": anyone with enough capital and time can replicate this (commodity capacity expansion, hiring at scale, contract manufacturing).

   D. VALUE CHAIN POSITION — state precisely where in the value chain this company sits. Do not be vague. Example: "sole qualified supplier for wafer bonding in HBM3 production at Samsung and SK Hynix" or "critical pick-and-shovel play in the AI power infrastructure stack — provides custom transformers that no incumbent currently supplies at scale."

   E. RENT CAPTURE — being positioned in a bottleneck and capturing the economic rent from it are two different things. Who actually captures the margin? Does pricing power flow to this company, or do customers, OEMs, or upstream suppliers absorb it? Cite any evidence of pricing power (contract structure, gross margin trend, customer switching costs).

   F. INVESTABILITY — is this an investable bottleneck? (true/false). Answer true only if ALL THREE apply:
      (1) The constraint is durable or slowly-moving (not solvable by capital in the next 12 months).
      (2) The company controls or is the primary and non-displaceable beneficiary of the constraint.
      (3) The market has not yet fully priced in the constraint advantage (identifiable via valuation discount vs constraint quality, or analyst consensus underestimating duration).

   G. WHO RELIEVES THE CONSTRAINT — identify: (i) who has the power to relieve this bottleneck (a specific company, regulator, or technology shift); (ii) what their incentive is; (iii) what their strategic ability is; (iv) what sits OUTSIDE their control (raw material availability, geopolitical factors, physics limits, qualification timelines). Be specific — name the players.

   H. INVESTABLE WINDOW — how long does this constraint persist as an investable window before consensus prices it in? Give a time estimate and explain what event or announcement would signal the window is closing (e.g. "18–24 months — window closes when TSMC announces next-gen capacity expansion or a second supplier passes HBM qualification").

10. MANAGEMENT QUALITY ASSESSMENT — rate management independently of the investment thesis. This assessment is purely about execution capability and capital stewardship; it does NOT influence the investment score.

   Grade A (90–100): exceptional — founder-led or proven CEO with consistent outperformance, strong insider alignment, disciplined capital allocation, clear and credible communication.
   Grade B (70–89): solid — experienced team, generally good execution, minor concerns (high stock-based comp, modest guidance misses, recent transition).
   Grade C (50–69): average — mixed track record, some execution gaps, unclear succession, or capital allocation concerns (acquisitions at poor prices, excessive dilution).
   Grade D (30–49): below average — repeated guidance misses, sudden senior departures, insider selling at scale, weak board oversight.
   Grade F (0–29): poor — fraud allegations, SEC investigation, governance failures, CEO departure under pressure, or consistent destruction of shareholder value.

   management_rating fields:
   - grade: letter grade A/B/C/D/F
   - score: numeric 0–100
   - summary: 2–3 sentence executive summary of management quality
   - ceo_assessment: 1–2 sentences on CEO specifically (tenure, track record, alignment)
   - recent_changes: any CEO/CFO/CTO changes in the past 12 months and whether each is a positive or negative signal (if no changes, state that explicitly)
   - capital_allocation: 1–2 sentences on how management deploys capital (buybacks, M&A, R&D intensity, dilution discipline)

Use web search for current information. Return only the JSON object.`;
  const finalPrompt =
    provider === "gemini"
      ? geminiSearchPrefix(
          step1.company_name,
          "business model moat technology advantage",
        ) + prompt
      : prompt;
  const { text } = await callLLM(finalPrompt, provider);

  const duration = Date.now() - startTime;
  const result = await parseWithGeminiRetry<Step2Output>(
    text,
    finalPrompt,
    provider,
    "Step 2",
  );
  emit({ step: 2, label: "Deep Dive", status: "complete", duration });
  console.log(
    `[Step 2] complete — moat: ${result.moat.substring(0, 80)}, catalysts: ${result.catalysts.length} (${duration}ms)`,
  );
  return result;
}

async function runStep3(
  step1: Step1Output,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<Step3Output> {
  const ctx = formatStep1Context(step1);
  emit({ step: 3, label: "Valuation & Financials", status: "started" });
  const startTime = Date.now();

  const prompt = `You are a financial analyst specialising in equity valuation.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "valuation_table": [
    { "ticker": "string", "name": "string", "ps_ratio": number_or_null, "ev_ebitda": number_or_null, "gross_margin": number_or_null, "yoy_growth": number_or_null }
  ],
  "napkin_math": {
    "revenue_guidance": "string",
    "comp_ticker": "string",
    "comp_multiple": number,
    "target_price": number,
    "upside_percent": number
  },
  "scenarios": [
    { "label": "Bear", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number, "rationale": "string" },
    { "label": "Base", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number, "rationale": "string" },
    { "label": "Bull", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number, "rationale": "string" }
  ],
  "financial_summary": "string",
  "quarterly_results": [
    { "quarter": "string", "revenue_est": number_or_null, "revenue_act": number_or_null, "revenue_growth": number_or_null, "eps_est": number_or_null, "eps_act": number_or_null }
  ]
}
Use null (not "null") for unknown numeric values. Revenue values in millions (e.g. 340 = $340M). revenue_growth as a percentage (e.g. 18.2 = 18.2% YoY). quarterly_results must contain the last 4 reported quarters, most recent first.
napkin_math must reflect the Base scenario. scenarios must always contain exactly 3 objects with labels "Bear", "Base", "Bull".

${ctx}

Provide valuation and financial analysis for the company above:
1. Relative valuation table including ALL major peers (minimum 3, ideally 4–5): P/S ratio, EV/EBITDA, gross margin %, YoY revenue growth %.
   COMP SELECTION RULE: Match comparables by GROWTH STAGE first, then industry. If the subject company is growing >50% YoY, at least 2 of your comps must also be growing >30% YoY. Never use a mature low-growth peer as the primary anchor for a hypergrowth company.
2. Revenue segment breakdown as percentages of total revenue — use the most recent filing. Include in the financial_summary.
3. Customer metrics: total active customer count, new customers in most recent quarter, top customer concentration (% of revenue). Include in the financial_summary.
4. Three valuation scenarios using the comp table above:
   - Bear: apply the LOWEST multiple peer to next-12-month revenue guidance. State which comp and why it is the bear case.
   - Base: apply the MEDIAN multiple of your comp set to next-12-month revenue guidance.
   - Bull: apply the HIGHEST-multiple hypergrowth comparable (must have >30% YoY growth) to next-12-month revenue guidance. If pipeline optionality exists (platform company, multiple indications), add a platform premium of 20–40%.
   napkin_math should mirror the Base scenario.
5. Gross margin trajectory: state whether margin has been IMPROVING, STABLE, or DETERIORATING over the last 4 quarters and by how many percentage points. Include in financial_summary.
6. Brief financial summary (3–4 sentences) covering: revenue growth rate, gross margin trend, path to profitability, dilution risk.
7. Last 4 reported quarters (most recent first): quarter, revenue estimate, revenue actual, YoY growth %, EPS estimate, EPS actual. Use null for unknown values.

Use web search for current financials. Return only the JSON object.`;
  const finalPrompt =
    provider === "gemini"
      ? geminiSearchPrefix(
          step1.company_name,
          "stock valuation financials revenue earnings",
        ) + prompt
      : prompt;
  const { text } = await callLLM(finalPrompt, provider);

  const duration = Date.now() - startTime;
  const result = await parseWithGeminiRetry<Step3Output>(
    text,
    finalPrompt,
    provider,
    "Step 3",
  );
  emit({
    step: 3,
    label: "Valuation & Financials",
    status: "complete",
    duration,
  });
  console.log(
    `[Step 3] complete — target: $${result.napkin_math.target_price}, upside: ${result.napkin_math.upside_percent}%, rows: ${result.valuation_table.length} (${duration}ms)`,
  );
  return result;
}

async function runStep4(
  step1: Step1Output,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<Step4Output> {
  const ctx = formatStep1Context(step1);
  emit({ step: 4, label: "Risk Red Team", status: "started" });
  const startTime = Date.now();

  const prompt = `You are a bearish research analyst performing a risk red team analysis.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "bear_case": "string",
  "risk_factors": ["string", "string", "string"],
  "tail_risks": ["string", "string"],
  "bear_case_rebuttal": "string"
}
bear_case_rebuttal: 2–3 sentences arguing what the bears consistently miss or underweight — write this from the bull's perspective as a genuine counter-argument.

${ctx}

Perform a bear case analysis on the company above.
Complete this analysis in 4 web searches maximum. Be concise. Total response must be under 800 words.

Search targets:
1. "[company name] [ticker] short report bear case risks"
2. "[ticker] SEC 10-K risk factors"
3. "[ticker] earnings miss history"
4. "[ticker] customer concentration revenue"

Provide:
1. Bear case — write it as a short seller would (3-point thesis on why this fails). Focus on STRUCTURAL risks (permanent threats to the business model) not temporary news events.
   CRITICAL DISTINCTION:
   - STRUCTURAL risk: competitive displacement, broken unit economics, debt covenant breach, customer concentration collapse, technology becoming obsolete.
   - TEMPORARY overhang: recent regulatory correspondence, pending litigation that is likely to resolve, short-term macro headwinds, recent management noise. Do NOT let temporary overhangs dominate the structural bear case.
2. Top 3 risk factors from SEC filings (10-K/10-Q) — cite the actual filing language where possible.
3. Two tail risks (low probability, high impact scenarios that would be existential).
4. Bear case rebuttal — step outside the bear role and write 2–3 sentences arguing what the bears consistently miss: the platform optionality, the growth trajectory underestimation, the aligned insider incentives, or the short-squeeze reflexivity. This must be a genuine counter-argument, not a dismissal.

Return only the JSON object.`;
  const finalPrompt =
    provider === "gemini"
      ? geminiSearchPrefix(
          step1.company_name,
          "risk factors bear case short thesis",
        ) + prompt
      : prompt;
  const { text } = await callLLM(finalPrompt, provider);

  const duration = Date.now() - startTime;
  const result = await parseWithGeminiRetry<Step4Output>(
    text,
    finalPrompt,
    provider,
    "Step 4",
  );
  emit({ step: 4, label: "Risk Red Team", status: "complete", duration });
  console.log(
    `[Step 4] complete — risk_factors: ${result.risk_factors.length}, tail_risks: ${result.tail_risks.length} (${duration}ms)`,
  );
  return result;
}

async function runStep5(
  step1: Step1Output,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<Step5Output> {
  const ctx = formatStep1Context(step1);
  emit({ step: 5, label: "Macro & Sector", status: "started" });
  const startTime = Date.now();

  const prompt = `You are a macro and sector analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "macro_summary": "string",
  "sector_heat": integer_1_to_5,
  "hot_sector_match": ["string"],
  "tariff_exposure": "string"
}
sector_heat must be an integer 1–5 (1=cold, 5=very hot). hot_sector_match must be a subset of the provided hot sectors list.

${ctx}

Analyse macro conditions and sector positioning for the company above.
Hot sectors to evaluate against: ${HOT_SECTORS.join(", ")}

Analyse:
1. Macro tailwinds and headwinds (Fed policy, rates, tariffs, government spending)
2. Sector heat score 1–5 (how hot is this sector right now?)
3. Which of the hot sectors does this company match? (list only those that apply, or empty array)
4. Tariff and supply chain exposure

Use web search for current macro context. Return only the JSON object.`;
  const finalPrompt =
    provider === "gemini"
      ? geminiSearchPrefix(
          step1.company_name,
          "macro sector policy regulatory environment",
        ) + prompt
      : prompt;
  const { text } = await callLLM(finalPrompt, provider);

  const duration = Date.now() - startTime;
  const result = await parseWithGeminiRetry<Step5Output>(
    text,
    finalPrompt,
    provider,
    "Step 5",
  );
  emit({ step: 5, label: "Macro & Sector", status: "complete", duration });
  console.log(
    `[Step 5] complete — sector_heat: ${result.sector_heat}/5, hot_matches: ${result.hot_sector_match.join(", ") || "none"} (${duration}ms)`,
  );
  return result;
}

async function runStep6(
  step1: Step1Output,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<Step6Output> {
  const ctx = formatStep1Context(step1);
  emit({ step: 6, label: "Sentiment & Technicals", status: "started" });
  const startTime = Date.now();

  const prompt = `You are a technical and sentiment analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "sentiment_summary": "string",
  "short_interest": "string",
  "ma_position": "string",
  "rs_vs_spy": "string"
}

${ctx}

Analyse current market sentiment and technicals for the company above:
1. Overall sentiment summary (retail + institutional)
2. Short interest (% of float, recent changes)
3. Position vs 200-day moving average (above/below, by how much %)
4. Relative strength vs SPY over last 3 months (outperforming/underperforming by X%)

Use web search for current market data. Return only the JSON object.`;
  const finalPrompt =
    provider === "gemini"
      ? geminiSearchPrefix(
          step1.company_name,
          "stock price technicals sentiment short interest",
        ) + prompt
      : prompt;
  const { text } = await callLLM(finalPrompt, provider);

  const duration = Date.now() - startTime;
  const result = await parseWithGeminiRetry<Step6Output>(
    text,
    finalPrompt,
    provider,
    "Step 6",
  );
  emit({
    step: 6,
    label: "Sentiment & Technicals",
    status: "complete",
    duration,
  });
  console.log(
    `[Step 6] complete — short_interest: ${result.short_interest}, ma_position: ${result.ma_position} (${duration}ms)`,
  );
  return result;
}

async function runStep7(
  ctx: PipelineContext,
  ticker: string,
  runId: string,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<PipelineResult> {
  const { step1, step2, step3, step4, step5, step6 } = ctx;

  const scenarioSummary = (step3.scenarios ?? [])
    .map(
      (s) =>
        `${s.label}: $${s.target_price} (${s.upside_percent}% upside) via ${s.comp_ticker} at ${s.comp_multiple}x — ${s.rationale}`,
    )
    .join(" | ");

  const contextSummary = `TICKER: ${ticker}
COMPANY: ${step1.company_name}
INDUSTRY: ${step1.industry} | SECTOR: ${step1.sector}
PRODUCT: ${step1.primary_product} | REGION: ${step1.primary_region}
COMPETITORS: ${(step1.competitors ?? []).map((c) => `${c.name} (${c.ticker})`).join(", ")}
TOP CUSTOMERS: ${(step1.customers ?? []).join(", ")}

BUSINESS MODEL: ${step2.business_model ?? ""}
MOAT: ${step2.moat ?? ""}
TECH ADVANTAGE: ${step2.technological_advantage ?? ""}
PLATFORM TYPE: ${step2.platform_type ?? "unknown"}
PLATFORM OPTIONALITY: ${step2.platform_optionality ?? "none"}
RERATING CATALYST: ${step2.rerating_catalyst ?? ""}
CATALYSTS: ${(step2.catalysts ?? []).join(" | ")}

CONSTRAINT ANALYSIS:
  TYPE: ${step2.constraint_analysis?.type ?? "none"}
  CONTROLS CONSTRAINT: ${step2.constraint_analysis?.controls_constraint ?? false}
  DURABILITY: ${step2.constraint_analysis?.durability ?? "unknown"}
  VALUE CHAIN POSITION: ${step2.constraint_analysis?.value_chain_position ?? ""}
  RENT CAPTURE: ${step2.constraint_analysis?.rent_capture ?? ""}
  INVESTABLE: ${step2.constraint_analysis?.investable ?? false}
  WHO RELIEVES: ${step2.constraint_analysis?.who_relieves ?? ""}
  WINDOW: ${step2.constraint_analysis?.window ?? ""}

VALUATION SUMMARY: ${step3.financial_summary ?? ""}
BASE TARGET: $${step3.napkin_math?.target_price ?? 0} (${step3.napkin_math?.upside_percent ?? 0}% upside) vs ${step3.napkin_math?.comp_ticker ?? ""} at ${step3.napkin_math?.comp_multiple ?? 0}x
SCENARIOS: ${scenarioSummary || "none"}

BEAR CASE: ${step4.bear_case ?? ""}
RISK FACTORS: ${(step4.risk_factors ?? []).join(" | ")}
BEAR CASE REBUTTAL: ${step4.bear_case_rebuttal ?? ""}

MACRO: ${step5.macro_summary ?? ""}
SECTOR HEAT: ${step5.sector_heat ?? 3}/5 | MATCHED SECTORS: ${(step5.hot_sector_match ?? []).join(", ") || "none"}
TARIFF: ${step5.tariff_exposure ?? ""}

SENTIMENT: ${step6.sentiment_summary ?? ""}
SHORT INTEREST: ${step6.short_interest ?? ""}
200-DAY MA: ${step6.ma_position ?? ""}
RS vs SPY: ${step6.rs_vs_spy ?? ""}`;

  emit({ step: 7, label: "Synthesis & Diagram", status: "started" });
  const startTime = Date.now();

  const { text, model } = await callLLM(
    `You must respond with ONLY a valid JSON object.
No preamble, no explanation, no markdown code blocks,
no text before or after the JSON.
Start your response with { and end with }
Any other format will cause a system failure.

You are a senior investment analyst synthesising a complete research report.
Respond ONLY with a valid JSON object with exactly two keys: "report" and "diagram".
No markdown, no explanation, raw JSON only.

SCORING RUBRIC — use this exact weighting to calculate the score (1.0–10.0):
- Sector momentum (20%): Is this a hot sector (AI, Defense, Space, Nuclear, Semiconductors, Robotics)? Hot sector = +2.0 floor contribution. Cold sector = +0.5.
- Revenue growth velocity (25%): >100% YoY = 2.5 pts. 50–100% = 2.0 pts. 20–50% = 1.5 pts. <20% = 0.5 pts. Declining = 0 pts.
- Valuation vs peers (20%): Trading at a discount to peer EV/Sales median = +2.0. At par = +1.0. Premium = +0.5.
- Moat quality (20%): Strong (IP + switching costs + regulatory moat) = +2.0. Moderate (one strong factor) = +1.2. Weak = +0.4.
- Execution risk (15%): Clear path to profitability, low dilution risk = +1.5. Some concerns = +0.8. High risk = +0.2.

IMPORTANT SCORING CONSTRAINTS:
- A company with >100% YoY revenue growth in a hot sector with any moat must score at least 5.0.
- Lack of profitability alone must NOT drag a high-growth company below 4.0 if sector momentum and growth are strong.
- If the primary bear case risks are TEMPORARY OVERHANGS (recent regulatory letters, pending litigation likely to resolve, short-term macro events from the last 90 days) rather than structural flaws, do NOT reduce the score below 4.5 for a company with >50% YoY growth and a genuine moat.
- Platform companies (core technology applicable across multiple markets) deserve a platform premium: add +0.5 to the final score if platform_type is "platform" and platform_optionality lists 2+ adjacent markets.
- Weigh execution risk as a modifier on the upside, not a reason to discount the floor.
- CONSTRAINT PREMIUM: If constraint_analysis.investable is true AND controls_constraint is true AND durability is "durable", add +0.5 to the moat quality score (effectively boosting the final score). This reflects that controlling a durable bottleneck is a rare and underappreciated source of asymmetric upside.
- CONSTRAINT PENALTY: If the company is positioned NEAR a bottleneck but does NOT control it (controls_constraint is false) and rent_capture indicates value accrues elsewhere, do NOT credit it as a moat. Being adjacent to a constraint is not a moat — it is an opportunity that can be disrupted.

NAPKIN MATH RULE: Use the Base scenario comp for the primary napkin_math target_price. NEVER use the Bear scenario comp as the primary target for a company growing >50% YoY — that produces a misleadingly pessimistic anchor. The Bear scenario belongs in the scenarios array, not as the headline number.

"report" must match this exact structure:
{
  "thesis": "One-liner investment thesis",
  "business_model": "string",
  "moat": "string",
  "competitors": [{ "ticker": "string", "name": "string" }],
  "napkin_math": { "revenue_guidance": "string", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number },
  "scenarios": [
    { "label": "Bear", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number, "rationale": "string" },
    { "label": "Base", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number, "rationale": "string" },
    { "label": "Bull", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number, "rationale": "string" }
  ],
  "platform_optionality": "string",
  "rerating_catalyst": "string",
  "bear_case": "string",
  "bear_case_rebuttal": "string",
  "sector_heat": integer_1_to_5,
  "hot_sector_match": ["string"],
  "valuation_table": [{ "ticker": "string", "name": "string", "ps_ratio": number_or_null, "ev_ebitda": number_or_null, "gross_margin": number_or_null, "yoy_growth": number_or_null }],
  "catalysts": ["string"],
  "risk_factors": ["string"],
  "macro_summary": "string",
  "sentiment_summary": "string",
  "score": number_1.0_to_10.0_calculated_from_scoring_rubric_above,
  "constraint_analysis": {
    "type": "string",
    "controls_constraint": boolean,
    "durability": "string",
    "value_chain_position": "string",
    "rent_capture": "string",
    "investable": boolean,
    "who_relieves": "string",
    "window": "string"
  },
  "pipeline_steps_raw": {}
}

"diagram" must match this React Flow spec:
{
  "nodes": [{ "id": "string", "type": "revenue|customer|moat|business_unit|risk", "data": { "label": "string", "detail": "string" }, "position": { "x": number, "y": number } }],
  "edges": [{ "id": "string", "source": "string", "target": "string", "label": "string" }]
}
Layout: revenue streams on left (x≈0), business_unit in centre (x≈300), customers on right (x≈600), moat above (y≈0), risks below (y≈400). Space nodes 120px apart vertically.

Synthesise a complete moat-finder report for ${ticker}.

${contextSummary}

Return only the JSON object with "report" and "diagram" keys.`,
    provider,
    false,
  );

  const duration = Date.now() - startTime;

  let parsed: { report: ReportJson; diagram: DiagramJson };
  try {
    parsed = extractJSON(text) as { report: ReportJson; diagram: DiagramJson };
  } catch (parseError) {
    const message =
      parseError instanceof Error ? parseError.message : "JSON parse failed";
    console.error("[Step 7] JSON parse failed:", message);
    console.error(
      "[Step 7] Raw response first 500 chars:",
      text.substring(0, 500),
    );
    emit({
      step: 0,
      label: "Error",
      status: "error",
      data: { message: `Synthesis failed: ${message}` },
    });
    await adminClient
      .from("research_checkpoints")
      .delete()
      .eq("ticker_symbol", ticker)
      .eq("step_number", 7);
    throw new Error(`Synthesis failed (provider: ${provider}): ${message}`);
  }

  // Store raw pipeline context for auditability
  parsed.report.pipeline_steps_raw = {
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
  };

  // Record which LLM generated this report
  parsed.report.llm_provider = provider;
  parsed.report.llm_model = model;

  // Carry quarterly results from Step 3 into the final report
  if (step3.quarterly_results && step3.quarterly_results.length > 0) {
    parsed.report.quarterly_results = step3.quarterly_results;
  }

  // Carry management_rating from Step 2 — injected after LLM synthesis so it
  // cannot influence the investment score calculation.
  if (step2.management_rating) {
    parsed.report.management_rating = step2.management_rating;
  }

  await saveCheckpoint(ticker, runId, {
    step_number: 7,
    step_label: "Synthesis & Diagram",
    output_json: {
      report: parsed.report as unknown as Record<string, unknown>,
      diagram: parsed.diagram as unknown as Record<string, unknown>,
    },
    duration_ms: duration,
  });

  emit({
    step: 7,
    label: "Synthesis & Diagram",
    status: "complete",
    duration,
  });
  console.log(
    `[Step 7] complete — thesis: ${parsed.report.thesis.substring(0, 80)}, diagram nodes: ${(parsed.diagram?.nodes ?? []).length}, edges: ${(parsed.diagram?.edges ?? []).length}, provider: ${provider} (${duration}ms)`,
  );
  return { report: parsed.report, diagram: parsed.diagram, runId };
}

// ─── Step execution with fallback ─────────────────────────────────────────────

/**
 * Run a single pipeline step, save its checkpoint on success, and emit an error
 * event + return the default value on failure. Used by both runParallelSteps
 * (via runOrResume) and runUpdatePipeline (directly, for steps 3/5/6 only).
 */
async function runStepWithFallback<T>(
  stepNum: number,
  label: string,
  runner: () => Promise<T>,
  defaultVal: T,
  ticker: string,
  runId: string,
  emit: EmitFn,
): Promise<T> {
  try {
    const result = await runner();
    await saveCheckpoint(ticker, runId, {
      step_number: stepNum,
      step_label: label,
      output_json: result as Record<string, unknown>,
    });
    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : `Step ${stepNum} failed`;
    emit({ step: stepNum, label, status: "error", data: { message } });
    console.warn(
      `[Step ${stepNum}] failed — using default. Reason: ${message}`,
    );
    return defaultVal;
  }
}

// ─── Step defaults (used when a parallel step fails — Step 7 still runs) ──────

const DEFAULT_STEP2: Step2Output = {
  business_model: "",
  moat: "",
  technological_advantage: "",
  catalysts: [],
};
const DEFAULT_STEP3: Step3Output = {
  valuation_table: [],
  napkin_math: {
    revenue_guidance: "",
    comp_ticker: "",
    comp_multiple: 0,
    target_price: 0,
    upside_percent: 0,
  },
  financial_summary: "",
};
const DEFAULT_STEP4: Step4Output = {
  bear_case: "",
  risk_factors: [],
  tail_risks: [],
};
const DEFAULT_STEP5: Step5Output = {
  macro_summary: "",
  sector_heat: 3,
  hot_sector_match: [],
  tariff_exposure: "",
};
const DEFAULT_STEP6: Step6Output = {
  sentiment_summary: "",
  short_interest: "",
  ma_position: "",
  rs_vs_spy: "",
};

/**
 * Run steps 2-6 concurrently. Skips any step already in cachedSteps (checkpoint resume).
 * Saves each completed step to checkpoints immediately. Falls back to defaults on failure.
 */
async function runParallelSteps(
  step1: Step1Output,
  ticker: string,
  runId: string,
  cachedSteps: Map<number, Record<string, unknown>>,
  emit: EmitFn,
  provider: LLMProvider,
): Promise<[Step2Output, Step3Output, Step4Output, Step5Output, Step6Output]> {
  async function runOrResume<T>(
    stepNum: number,
    label: string,
    runner: () => Promise<T>,
    defaultVal: T,
  ): Promise<T> {
    if (cachedSteps.has(stepNum)) {
      emit({
        step: stepNum,
        label,
        status: "complete",
        resumed: true,
        duration: 0,
      });
      console.log(`[Step ${stepNum}] resumed from checkpoint`);
      return cachedSteps.get(stepNum) as T;
    }
    return runStepWithFallback(
      stepNum,
      label,
      runner,
      defaultVal,
      ticker,
      runId,
      emit,
    );
  }

  const [step2, step3, step4, step5, step6] = await Promise.all([
    runOrResume(
      2,
      "Deep Dive",
      () => runStep2(step1, emit, provider),
      DEFAULT_STEP2,
    ),
    runOrResume(
      3,
      "Valuation & Financials",
      () => runStep3(step1, emit, provider),
      DEFAULT_STEP3,
    ),
    runOrResume(
      4,
      "Risk Red Team",
      () => runStep4(step1, emit, provider),
      DEFAULT_STEP4,
    ),
    runOrResume(
      5,
      "Macro & Sector",
      () => runStep5(step1, emit, provider),
      DEFAULT_STEP5,
    ),
    runOrResume(
      6,
      "Sentiment & Technicals",
      () => runStep6(step1, emit, provider),
      DEFAULT_STEP6,
    ),
  ]);

  return [step2, step3, step4, step5, step6];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full 7-step research pipeline with checkpoint resume support.
 * Step 1 runs first; steps 2-6 run concurrently; step 7 synthesises.
 * Each completed step is saved to research_checkpoints immediately.
 * Checkpoints are cleared by the route handler after successful Supabase save.
 */
export async function runPipeline(
  ticker: string,
  emit: EmitFn,
  provider: LLMProvider = "claude",
): Promise<PipelineResult> {
  // Load existing checkpoints — resume in-progress run if present
  const existing = await loadCheckpoints(ticker);
  const runId = existing?.runId ?? randomUUID();
  const cachedSteps =
    existing?.steps ?? new Map<number, Record<string, unknown>>();

  if (cachedSteps.size > 0) {
    console.log(
      `[runPipeline] Resuming ${ticker} run ${runId} — cached steps: ${[...cachedSteps.keys()].sort((a, b) => a - b).join(", ")}`,
    );
  }

  // If Step 2 is cached from a run that predates management_rating, force re-run
  if (cachedSteps.has(2)) {
    const step2Cached = cachedSteps.get(2) as Step2Output | undefined;
    if (!step2Cached?.management_rating) {
      console.log(
        `[${ticker}] Cached Step 2 missing management_rating — forcing Step 2 re-run`,
      );
      cachedSteps.delete(2);
      await deleteStepCheckpoint(ticker, runId, 2);
    }
  }

  // Step 1 — Discovery (always fast; run fresh to get current company data)
  let step1: Step1Output;
  if (cachedSteps.has(1)) {
    step1 = cachedSteps.get(1) as unknown as Step1Output;
    emit({
      step: 1,
      label: "Discovery",
      status: "complete",
      resumed: true,
      duration: 0,
    });
    console.log("[Step 1] resumed from checkpoint");
  } else {
    step1 = await runStep1(ticker, emit, provider);
    await saveCheckpoint(ticker, runId, {
      step_number: 1,
      step_label: "Discovery",
      output_json: step1 as unknown as Record<string, unknown>,
    });
  }

  const [step2, step3, step4, step5, step6] = await runParallelSteps(
    step1,
    ticker,
    runId,
    cachedSteps,
    emit,
    provider,
  );

  const ctx: PipelineContext = { step1, step2, step3, step4, step5, step6 };
  return runStep7(ctx, ticker, runId, emit, provider);
}

/**
 * Smart update pipeline — skips steps 2 (Deep Dive) and 4 (Risk Red Team),
 * reusing their data from the existing report. Runs steps 3, 5, 6 concurrently.
 * Uses a fresh runId (updates are not resumed — they always run from scratch).
 */
export async function runUpdatePipeline(
  ticker: string,
  existingReport: ReportJson,
  emit: EmitFn,
  provider: LLMProvider = "claude",
): Promise<PipelineResult> {
  const runId = randomUUID();

  const step1 = await runStep1(ticker, emit, provider);
  await saveCheckpoint(ticker, runId, {
    step_number: 1,
    step_label: "Discovery",
    output_json: step1 as unknown as Record<string, unknown>,
  });

  // Reconstruct base data from existing report
  const rawSteps = existingReport.pipeline_steps_raw;
  const rawStep2 = rawSteps["step2"] as Partial<Step2Output> | undefined;
  const rawStep4 = rawSteps["step4"] as Partial<Step4Output> | undefined;

  // Step 4 is always reused from the existing report
  const cachedStep4: Step4Output = {
    bear_case: existingReport.bear_case ?? "",
    risk_factors: existingReport.risk_factors ?? [],
    tail_risks: rawStep4?.tail_risks ?? [],
    bear_case_rebuttal:
      existingReport.bear_case_rebuttal ?? rawStep4?.bear_case_rebuttal ?? "",
  };
  emit({
    step: 4,
    label: "Risk Red Team",
    status: "cached",
    data: { message: "Using previous research" },
  });

  const needsManagementRating = !existingReport.management_rating;

  let step2: Step2Output;
  let step3: Step3Output;
  let step5: Step5Output;
  let step6: Step6Output;

  if (needsManagementRating) {
    console.log(
      `[${ticker}] management_rating missing — forcing Step 2 re-run`,
    );
    // Clear any stale Step 2 checkpoint (housekeeping — update always uses fresh runId)
    await adminClient
      .from("research_checkpoints")
      .delete()
      .eq("ticker_symbol", ticker)
      .eq("step_number", 2);

    // Run Step 2 fresh, concurrently with 3/5/6
    const fresh = await Promise.all([
      runStepWithFallback(
        2,
        "Deep Dive",
        () => runStep2(step1, emit, provider),
        DEFAULT_STEP2,
        ticker,
        runId,
        emit,
      ),
      runStepWithFallback(
        3,
        "Valuation & Financials",
        () => runStep3(step1, emit, provider),
        DEFAULT_STEP3,
        ticker,
        runId,
        emit,
      ),
      runStepWithFallback(
        5,
        "Macro & Sector",
        () => runStep5(step1, emit, provider),
        DEFAULT_STEP5,
        ticker,
        runId,
        emit,
      ),
      runStepWithFallback(
        6,
        "Sentiment & Technicals",
        () => runStep6(step1, emit, provider),
        DEFAULT_STEP6,
        ticker,
        runId,
        emit,
      ),
    ]);
    step2 = fresh[0];
    step3 = fresh[1];
    step5 = fresh[2];
    step6 = fresh[3];
  } else {
    console.log(`[${ticker}] management_rating exists — using cached Step 2`);
    // Carry existing management_rating through so Step 7 can inject it post-synthesis
    step2 = {
      business_model: existingReport.business_model ?? "",
      moat: existingReport.moat ?? "",
      technological_advantage: rawStep2?.technological_advantage ?? "",
      catalysts: existingReport.catalysts ?? [],
      platform_type: rawStep2?.platform_type ?? undefined,
      platform_optionality:
        existingReport.platform_optionality ??
        rawStep2?.platform_optionality ??
        "",
      rerating_catalyst:
        existingReport.rerating_catalyst ?? rawStep2?.rerating_catalyst ?? "",
      constraint_analysis:
        existingReport.constraint_analysis ?? rawStep2?.constraint_analysis,
      management_rating: existingReport.management_rating,
    };
    emit({
      step: 2,
      label: "Deep Dive",
      status: "cached",
      data: { message: "Using previous research" },
    });
    console.log("[Update] Steps 2 and 4 skipped — reusing cached data");

    const cached = await Promise.all([
      runStepWithFallback(
        3,
        "Valuation & Financials",
        () => runStep3(step1, emit, provider),
        DEFAULT_STEP3,
        ticker,
        runId,
        emit,
      ),
      runStepWithFallback(
        5,
        "Macro & Sector",
        () => runStep5(step1, emit, provider),
        DEFAULT_STEP5,
        ticker,
        runId,
        emit,
      ),
      runStepWithFallback(
        6,
        "Sentiment & Technicals",
        () => runStep6(step1, emit, provider),
        DEFAULT_STEP6,
        ticker,
        runId,
        emit,
      ),
    ]);
    step3 = cached[0];
    step5 = cached[1];
    step6 = cached[2];
  }

  const ctx: PipelineContext = {
    step1,
    step2,
    step3,
    step4: cachedStep4,
    step5,
    step6,
  };
  return runStep7(ctx, ticker, runId, emit, provider);
}
