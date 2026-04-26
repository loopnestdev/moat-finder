import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
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
  clearCheckpoints,
} from "./checkpoint";

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

// ─── Anthropic client ────────────────────────────────────────────────────────

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip markdown code fences if Claude wraps the JSON in them. */
function extractJson(text: string): string {
  const match = /```(?:json)?\s*([\s\S]+?)\s*```/.exec(text);
  return match ? (match[1] ?? text.trim()) : text.trim();
}

/** Format Step 1 output as a cacheable context string passed to steps 2-6. */
function formatStep1Context(step1: Step1Output): string {
  return `Company: ${step1.company_name} (${step1.primary_product}, ${step1.industry})
Sector: ${step1.sector} | Region: ${step1.primary_region}
Competitors: ${step1.competitors.map((c) => `${c.name} (${c.ticker})`).join(", ")}
Top Customers: ${step1.customers.join(", ")}`;
}

// ─── Claude call helpers ─────────────────────────────────────────────────────

/**
 * Shared loop: send messages to Claude, handle tool_use turns, return final text.
 */
async function runClaudeLoop(
  systemPrompt: string,
  initialMessages: MessageParam[],
): Promise<string> {
  const client = createAnthropicClient();
  const messages: MessageParam[] = [...initialMessages];

  for (;;) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");

    if (
      response.stop_reason === "end_turn" ||
      response.stop_reason === "stop_sequence"
    ) {
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }
      return textBlock.text;
    }

    // Defensive: handle client-side tool_use if it ever occurs
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: toolUseBlocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: "",
        })),
      });
      continue;
    }

    // max_tokens or other — return whatever text we have
    if (textBlock && textBlock.type === "text") return textBlock.text;
    throw new Error(`Unexpected stop_reason: ${String(response.stop_reason)}`);
  }
}

/** Simple single-message call (Step 1 and Step 7 which have unique context). */
async function callClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  return runClaudeLoop(systemPrompt, [{ role: "user", content: userMessage }]);
}

/**
 * Call Claude with a cached Step 1 context block + a step-specific prompt.
 * The cachedContext block is eligible for Anthropic prompt caching (ephemeral TTL ~5 min),
 * reducing input tokens by ~60-70% across the five parallel steps that share the same context.
 */
async function callClaudeWithCachedContext(
  systemPrompt: string,
  cachedContext: string,
  stepPrompt: string,
): Promise<string> {
  // Type assertion needed: cache_control is valid at runtime but may not be in all SDK typings.
  const messages = [
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: cachedContext,
          cache_control: { type: "ephemeral" as const },
        },
        { type: "text" as const, text: stepPrompt },
      ],
    },
  ] as MessageParam[];
  return runClaudeLoop(systemPrompt, messages);
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────

async function runStep1(ticker: string, emit: EmitFn): Promise<Step1Output> {
  const system = `You are a financial research analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "company_name": "string",
  "industry": "string",
  "sector": "string",
  "competitors": [{ "ticker": "string", "name": "string" }],
  "customers": ["string"],
  "primary_product": "string",
  "primary_region": "string"
}`;

  emit({ step: 1, label: "Discovery", status: "started" });
  const startTime1 = Date.now();
  const text = await callClaude(
    system,
    `Research the company with ticker symbol ${ticker}.
Identify: company name, industry, top 3 competitors (with their tickers), top 3 known customers,
primary product/service, and primary operating region.
Use web search for current information. Return only the JSON object.`,
  );
  const duration1 = Date.now() - startTime1;

  const result = JSON.parse(extractJson(text)) as Step1Output;
  emit({
    step: 1,
    label: "Discovery",
    status: "complete",
    duration: duration1,
    data: { company_name: result.company_name },
  });
  console.log(
    `[Step 1] complete — company: ${result.company_name}, industry: ${result.industry}, sector: ${result.sector} (${duration1}ms)`,
  );
  return result;
}

// Steps 2-6 each take only step1 as context — enables parallel execution.

async function runStep2(
  step1: Step1Output,
  emit: EmitFn,
): Promise<Step2Output> {
  const system = `You are a financial research analyst specialising in competitive moat analysis and value chain constraint mapping.
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
constraint_analysis.investable: true only if the bottleneck is (1) durable or slowly-moving, AND (2) the company controls or is the primary beneficiary, AND (3) the window is wide enough before consensus prices it in.
constraint_analysis.who_relieves: who has the power, incentive, and strategic ability to relieve this bottleneck — and what sits outside their control?
constraint_analysis.window: estimated time before consensus fully prices in this constraint advantage (e.g. "18–24 months — next-gen tooling announcements will expand capacity in 2026").`;

  const ctx = formatStep1Context(step1);
  emit({ step: 2, label: "Deep Dive", status: "started" });
  const startTime2 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Perform a deep dive analysis on the company above:
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

Use web search for current information. Return only the JSON object.`,
  );
  const duration2 = Date.now() - startTime2;

  const result = JSON.parse(extractJson(text)) as Step2Output;
  emit({
    step: 2,
    label: "Deep Dive",
    status: "complete",
    duration: duration2,
  });
  console.log(
    `[Step 2] complete — moat: ${result.moat.substring(0, 80)}, catalysts: ${result.catalysts.length} (${duration2}ms)`,
  );
  return result;
}

async function runStep3(
  step1: Step1Output,
  emit: EmitFn,
): Promise<Step3Output> {
  const system = `You are a financial analyst specialising in equity valuation.
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
napkin_math must reflect the Base scenario. scenarios must always contain exactly 3 objects with labels "Bear", "Base", "Bull".`;

  const ctx = formatStep1Context(step1);
  emit({ step: 3, label: "Valuation & Financials", status: "started" });
  const startTime3 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Provide valuation and financial analysis for the company above:
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

Use web search for current financials. Return only the JSON object.`,
  );
  const duration3 = Date.now() - startTime3;

  const result = JSON.parse(extractJson(text)) as Step3Output;
  emit({
    step: 3,
    label: "Valuation & Financials",
    status: "complete",
    duration: duration3,
  });
  console.log(
    `[Step 3] complete — target: $${result.napkin_math.target_price}, upside: ${result.napkin_math.upside_percent}%, rows: ${result.valuation_table.length} (${duration3}ms)`,
  );
  return result;
}

async function runStep4(
  step1: Step1Output,
  emit: EmitFn,
): Promise<Step4Output> {
  const system = `You are a bearish research analyst performing a risk red team analysis.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "bear_case": "string",
  "risk_factors": ["string", "string", "string"],
  "tail_risks": ["string", "string"],
  "bear_case_rebuttal": "string"
}
bear_case_rebuttal: 2–3 sentences arguing what the bears consistently miss or underweight — write this from the bull's perspective as a genuine counter-argument.`;

  const ctx = formatStep1Context(step1);
  emit({ step: 4, label: "Risk Red Team", status: "started" });
  const startTime4 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Perform a bear case analysis on the company above.
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

Return only the JSON object.`,
  );
  const duration4 = Date.now() - startTime4;

  const result = JSON.parse(extractJson(text)) as Step4Output;
  emit({
    step: 4,
    label: "Risk Red Team",
    status: "complete",
    duration: duration4,
  });
  console.log(
    `[Step 4] complete — risk_factors: ${result.risk_factors.length}, tail_risks: ${result.tail_risks.length} (${duration4}ms)`,
  );
  return result;
}

async function runStep5(
  step1: Step1Output,
  emit: EmitFn,
): Promise<Step5Output> {
  const system = `You are a macro and sector analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "macro_summary": "string",
  "sector_heat": integer_1_to_5,
  "hot_sector_match": ["string"],
  "tariff_exposure": "string"
}
sector_heat must be an integer 1–5 (1=cold, 5=very hot). hot_sector_match must be a subset of the provided hot sectors list.`;

  const ctx = formatStep1Context(step1);
  emit({ step: 5, label: "Macro & Sector", status: "started" });
  const startTime5 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Analyse macro conditions and sector positioning for the company above.
Hot sectors to evaluate against: ${HOT_SECTORS.join(", ")}

Analyse:
1. Macro tailwinds and headwinds (Fed policy, rates, tariffs, government spending)
2. Sector heat score 1–5 (how hot is this sector right now?)
3. Which of the hot sectors does this company match? (list only those that apply, or empty array)
4. Tariff and supply chain exposure

Use web search for current macro context. Return only the JSON object.`,
  );
  const duration5 = Date.now() - startTime5;

  const result = JSON.parse(extractJson(text)) as Step5Output;
  emit({
    step: 5,
    label: "Macro & Sector",
    status: "complete",
    duration: duration5,
  });
  console.log(
    `[Step 5] complete — sector_heat: ${result.sector_heat}/5, hot_matches: ${result.hot_sector_match.join(", ") || "none"} (${duration5}ms)`,
  );
  return result;
}

async function runStep6(
  step1: Step1Output,
  emit: EmitFn,
): Promise<Step6Output> {
  const system = `You are a technical and sentiment analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "sentiment_summary": "string",
  "short_interest": "string",
  "ma_position": "string",
  "rs_vs_spy": "string"
}`;

  const ctx = formatStep1Context(step1);
  emit({ step: 6, label: "Sentiment & Technicals", status: "started" });
  const startTime6 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Analyse current market sentiment and technicals for the company above:
1. Overall sentiment summary (retail + institutional)
2. Short interest (% of float, recent changes)
3. Position vs 200-day moving average (above/below, by how much %)
4. Relative strength vs SPY over last 3 months (outperforming/underperforming by X%)

Use web search for current market data. Return only the JSON object.`,
  );
  const duration6 = Date.now() - startTime6;

  const result = JSON.parse(extractJson(text)) as Step6Output;
  emit({
    step: 6,
    label: "Sentiment & Technicals",
    status: "complete",
    duration: duration6,
  });
  console.log(
    `[Step 6] complete — short_interest: ${result.short_interest}, ma_position: ${result.ma_position} (${duration6}ms)`,
  );
  return result;
}

async function runStep7(
  ctx: PipelineContext,
  ticker: string,
  runId: string,
  emit: EmitFn,
): Promise<PipelineResult> {
  const { step1, step2, step3, step4, step5, step6 } = ctx;

  const system = `You are a senior investment analyst synthesising a complete research report.
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
Layout: revenue streams on left (x≈0), business_unit in centre (x≈300), customers on right (x≈600), moat above (y≈0), risks below (y≈400). Space nodes 120px apart vertically.`;

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
  const startTime7 = Date.now();
  const text = await callClaude(
    system,
    `Synthesise a complete moat-finder report for ${ticker}.\n\n${contextSummary}\n\nReturn only the JSON object with "report" and "diagram" keys.`,
  );
  const duration7 = Date.now() - startTime7;

  const parsed = JSON.parse(extractJson(text)) as {
    report: ReportJson;
    diagram: DiagramJson;
  };

  // Store raw pipeline context for auditability
  parsed.report.pipeline_steps_raw = {
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
  };

  // Carry quarterly results from Step 3 into the final report
  if (step3.quarterly_results && step3.quarterly_results.length > 0) {
    parsed.report.quarterly_results = step3.quarterly_results;
  }

  await saveCheckpoint(ticker, runId, {
    step_number: 7,
    step_label: "Synthesis & Diagram",
    output_json: {
      report: parsed.report as unknown as Record<string, unknown>,
      diagram: parsed.diagram as unknown as Record<string, unknown>,
    },
    duration_ms: duration7,
  });

  emit({
    step: 7,
    label: "Synthesis & Diagram",
    status: "complete",
    duration: duration7,
  });
  console.log(
    `[Step 7] complete — thesis: ${parsed.report.thesis.substring(0, 80)}, diagram nodes: ${(parsed.diagram?.nodes ?? []).length}, edges: ${(parsed.diagram?.edges ?? []).length} (${duration7}ms)`,
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
    runOrResume(2, "Deep Dive", () => runStep2(step1, emit), DEFAULT_STEP2),
    runOrResume(
      3,
      "Valuation & Financials",
      () => runStep3(step1, emit),
      DEFAULT_STEP3,
    ),
    runOrResume(4, "Risk Red Team", () => runStep4(step1, emit), DEFAULT_STEP4),
    runOrResume(
      5,
      "Macro & Sector",
      () => runStep5(step1, emit),
      DEFAULT_STEP5,
    ),
    runOrResume(
      6,
      "Sentiment & Technicals",
      () => runStep6(step1, emit),
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
    step1 = await runStep1(ticker, emit);
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
  );

  const ctx: PipelineContext = { step1, step2, step3, step4, step5, step6 };
  return runStep7(ctx, ticker, runId, emit);
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
): Promise<PipelineResult> {
  const runId = randomUUID();

  const step1 = await runStep1(ticker, emit);
  await saveCheckpoint(ticker, runId, {
    step_number: 1,
    step_label: "Discovery",
    output_json: step1 as unknown as Record<string, unknown>,
  });

  // Reconstruct step2/step4 from existing report — these are skipped
  const rawSteps = existingReport.pipeline_steps_raw;
  const rawStep2 = rawSteps["step2"] as Partial<Step2Output> | undefined;
  const rawStep4 = rawSteps["step4"] as Partial<Step4Output> | undefined;

  const cachedStep2: Step2Output = {
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
  };
  const cachedStep4: Step4Output = {
    bear_case: existingReport.bear_case ?? "",
    risk_factors: existingReport.risk_factors ?? [],
    tail_risks: rawStep4?.tail_risks ?? [],
    bear_case_rebuttal:
      existingReport.bear_case_rebuttal ?? rawStep4?.bear_case_rebuttal ?? "",
  };

  emit({
    step: 2,
    label: "Deep Dive",
    status: "cached",
    data: { message: "Using previous research" },
  });
  emit({
    step: 4,
    label: "Risk Red Team",
    status: "cached",
    data: { message: "Using previous research" },
  });
  console.log("[Update] Steps 2 and 4 skipped — reusing cached data");

  // Run only steps 3, 5, 6 concurrently — steps 2 and 4 are reused above
  const [step3, step5, step6] = await Promise.all([
    runStepWithFallback(
      3,
      "Valuation & Financials",
      () => runStep3(step1, emit),
      DEFAULT_STEP3,
      ticker,
      runId,
      emit,
    ),
    runStepWithFallback(
      5,
      "Macro & Sector",
      () => runStep5(step1, emit),
      DEFAULT_STEP5,
      ticker,
      runId,
      emit,
    ),
    runStepWithFallback(
      6,
      "Sentiment & Technicals",
      () => runStep6(step1, emit),
      DEFAULT_STEP6,
      ticker,
      runId,
      emit,
    ),
  ]);

  const ctx: PipelineContext = {
    step1,
    step2: cachedStep2,
    step3,
    step4: cachedStep4,
    step5,
    step6,
  };

  return runStep7(ctx, ticker, runId, emit);
}
