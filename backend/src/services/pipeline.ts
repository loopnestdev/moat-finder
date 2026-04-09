import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
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
} from '../types/report.types';
import { saveCheckpoint, loadCheckpoints, clearCheckpoints } from './checkpoint';

const HOT_SECTORS = [
  'Energy',
  'Power',
  'AI',
  'Space',
  'Nuclear',
  'Semiconductor',
  'Robotics',
  'Solar',
];


// ─── Anthropic client ────────────────────────────────────────────────────────

function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
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
Competitors: ${step1.competitors.map((c) => `${c.name} (${c.ticker})`).join(', ')}
Top Customers: ${step1.customers.join(', ')}`;
}

// ─── Claude call helpers ─────────────────────────────────────────────────────

/**
 * Shared loop: send messages to Claude, handle tool_use turns, return final text.
 */
async function runClaudeLoop(systemPrompt: string, initialMessages: MessageParam[]): Promise<string> {
  const client = createAnthropicClient();
  const messages: MessageParam[] = [...initialMessages];

  for (;;) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Claude response');
      }
      return textBlock.text;
    }

    // Defensive: handle client-side tool_use if it ever occurs
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
      );
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: toolUseBlocks.map((b) => ({
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: '',
        })),
      });
      continue;
    }

    // max_tokens or other — return whatever text we have
    if (textBlock && textBlock.type === 'text') return textBlock.text;
    throw new Error(`Unexpected stop_reason: ${String(response.stop_reason)}`);
  }
}

/** Simple single-message call (Step 1 and Step 7 which have unique context). */
async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  return runClaudeLoop(systemPrompt, [{ role: 'user', content: userMessage }]);
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
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: cachedContext, cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: stepPrompt },
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

  emit({ step: 1, label: 'Discovery', status: 'started' });
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
  emit({ step: 1, label: 'Discovery', status: 'complete', duration: duration1, data: { company_name: result.company_name } });
  console.log(`[Step 1] complete — company: ${result.company_name}, industry: ${result.industry}, sector: ${result.sector} (${duration1}ms)`);
  return result;
}

// Steps 2-6 each take only step1 as context — enables parallel execution.

async function runStep2(step1: Step1Output, emit: EmitFn): Promise<Step2Output> {
  const system = `You are a financial research analyst specialising in competitive moat analysis.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "business_model": "string",
  "moat": "string",
  "technological_advantage": "string",
  "catalysts": ["string"]
}`;

  const ctx = formatStep1Context(step1);
  emit({ step: 2, label: 'Deep Dive', status: 'started' });
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

Use web search for current information. Return only the JSON object.`,
  );
  const duration2 = Date.now() - startTime2;

  const result = JSON.parse(extractJson(text)) as Step2Output;
  emit({ step: 2, label: 'Deep Dive', status: 'complete', duration: duration2 });
  console.log(`[Step 2] complete — moat: ${result.moat.substring(0, 80)}, catalysts: ${result.catalysts.length} (${duration2}ms)`);
  return result;
}

async function runStep3(step1: Step1Output, emit: EmitFn): Promise<Step3Output> {
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
  "financial_summary": "string",
  "quarterly_results": [
    { "quarter": "string", "revenue_est": number_or_null, "revenue_act": number_or_null, "revenue_growth": number_or_null, "eps_est": number_or_null, "eps_act": number_or_null }
  ]
}
Use null (not "null") for unknown numeric values. Revenue values in millions (e.g. 340 = $340M). revenue_growth as a percentage (e.g. 18.2 = 18.2% YoY). quarterly_results must contain the last 4 reported quarters, most recent first.`;

  const ctx = formatStep1Context(step1);
  emit({ step: 3, label: 'Valuation & Financials', status: 'started' });
  const startTime3 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Provide valuation and financial analysis for the company above:
1. Relative valuation table including ALL major peers (minimum 3, ideally 4–5): P/S ratio, EV/EBITDA, gross margin %, YoY revenue growth %. For each peer, also note what their current EV/Sales multiple would imply as a target price — include this in the financial_summary.
2. Revenue segment breakdown as percentages of total revenue — use the most recent filing. Include in the financial_summary.
3. Customer metrics: total active customer count, new customers added in the most recent quarter, and top customer concentration (what % of revenue comes from the single largest customer). Include in the financial_summary.
4. Napkin math: management's latest revenue guidance (exact figures if stated), best comparable ticker, their EV/Sales multiple, implied target price, and upside % from current price.
5. Brief financial summary (3–4 sentences) covering: revenue growth rate, gross margin trend, path to profitability, and any dilution risk from share issuances.
6. Last 4 reported quarters of earnings (most recent first): quarter label (e.g. "Q4 2025"), revenue estimate in millions, revenue actual in millions, YoY revenue growth %, EPS estimate, EPS actual. Use null for unknown values.

Use web search for current financials and earnings results. Return only the JSON object.`,
  );
  const duration3 = Date.now() - startTime3;

  const result = JSON.parse(extractJson(text)) as Step3Output;
  emit({ step: 3, label: 'Valuation & Financials', status: 'complete', duration: duration3 });
  console.log(`[Step 3] complete — target: $${result.napkin_math.target_price}, upside: ${result.napkin_math.upside_percent}%, rows: ${result.valuation_table.length} (${duration3}ms)`);
  return result;
}

async function runStep4(step1: Step1Output, emit: EmitFn): Promise<Step4Output> {
  const system = `You are a bearish research analyst performing a risk red team analysis.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "bear_case": "string",
  "risk_factors": ["string", "string", "string"],
  "tail_risks": ["string", "string"]
}`;

  const ctx = formatStep1Context(step1);
  emit({ step: 4, label: 'Risk Red Team', status: 'started' });
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
1. Bear case — write it as a short seller would (3-point thesis on why this fails)
2. Top 3 risk factors from SEC filings and recent analyst reports
3. Two tail risks (low probability, high impact scenarios)

Return only the JSON object.`,
  );
  const duration4 = Date.now() - startTime4;

  const result = JSON.parse(extractJson(text)) as Step4Output;
  emit({ step: 4, label: 'Risk Red Team', status: 'complete', duration: duration4 });
  console.log(`[Step 4] complete — risk_factors: ${result.risk_factors.length}, tail_risks: ${result.tail_risks.length} (${duration4}ms)`);
  return result;
}

async function runStep5(step1: Step1Output, emit: EmitFn): Promise<Step5Output> {
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
  emit({ step: 5, label: 'Macro & Sector', status: 'started' });
  const startTime5 = Date.now();
  const text = await callClaudeWithCachedContext(
    system,
    ctx,
    `Analyse macro conditions and sector positioning for the company above.
Hot sectors to evaluate against: ${HOT_SECTORS.join(', ')}

Analyse:
1. Macro tailwinds and headwinds (Fed policy, rates, tariffs, government spending)
2. Sector heat score 1–5 (how hot is this sector right now?)
3. Which of the hot sectors does this company match? (list only those that apply, or empty array)
4. Tariff and supply chain exposure

Use web search for current macro context. Return only the JSON object.`,
  );
  const duration5 = Date.now() - startTime5;

  const result = JSON.parse(extractJson(text)) as Step5Output;
  emit({ step: 5, label: 'Macro & Sector', status: 'complete', duration: duration5 });
  console.log(`[Step 5] complete — sector_heat: ${result.sector_heat}/5, hot_matches: ${result.hot_sector_match.join(', ') || 'none'} (${duration5}ms)`);
  return result;
}

async function runStep6(step1: Step1Output, emit: EmitFn): Promise<Step6Output> {
  const system = `You are a technical and sentiment analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "sentiment_summary": "string",
  "short_interest": "string",
  "ma_position": "string",
  "rs_vs_spy": "string"
}`;

  const ctx = formatStep1Context(step1);
  emit({ step: 6, label: 'Sentiment & Technicals', status: 'started' });
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
  emit({ step: 6, label: 'Sentiment & Technicals', status: 'complete', duration: duration6 });
  console.log(`[Step 6] complete — short_interest: ${result.short_interest}, ma_position: ${result.ma_position} (${duration6}ms)`);
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
- Weigh execution risk as a modifier on the upside, not a reason to discount the floor.

"report" must match this exact structure:
{
  "thesis": "One-liner investment thesis",
  "business_model": "string",
  "moat": "string",
  "competitors": [{ "ticker": "string", "name": "string" }],
  "napkin_math": { "revenue_guidance": "string", "comp_ticker": "string", "comp_multiple": number, "target_price": number, "upside_percent": number },
  "bear_case": "string",
  "sector_heat": integer_1_to_5,
  "hot_sector_match": ["string"],
  "valuation_table": [{ "ticker": "string", "name": "string", "ps_ratio": number_or_null, "ev_ebitda": number_or_null, "gross_margin": number_or_null, "yoy_growth": number_or_null }],
  "catalysts": ["string"],
  "risk_factors": ["string"],
  "macro_summary": "string",
  "sentiment_summary": "string",
  "pipeline_steps_raw": {}
}

"diagram" must match this React Flow spec:
{
  "nodes": [{ "id": "string", "type": "revenue|customer|moat|business_unit|risk", "data": { "label": "string", "detail": "string" }, "position": { "x": number, "y": number } }],
  "edges": [{ "id": "string", "source": "string", "target": "string", "label": "string" }]
}
Layout: revenue streams on left (x≈0), business_unit in centre (x≈300), customers on right (x≈600), moat above (y≈0), risks below (y≈400). Space nodes 120px apart vertically.`;

  const contextSummary = `TICKER: ${ticker}
COMPANY: ${step1.company_name}
INDUSTRY: ${step1.industry} | SECTOR: ${step1.sector}
PRODUCT: ${step1.primary_product} | REGION: ${step1.primary_region}
COMPETITORS: ${(step1.competitors ?? []).map((c) => `${c.name} (${c.ticker})`).join(', ')}
TOP CUSTOMERS: ${(step1.customers ?? []).join(', ')}

BUSINESS MODEL: ${step2.business_model ?? ''}
MOAT: ${step2.moat ?? ''}
TECH ADVANTAGE: ${step2.technological_advantage ?? ''}
CATALYSTS: ${(step2.catalysts ?? []).join(' | ')}

VALUATION SUMMARY: ${step3.financial_summary ?? ''}
NAPKIN MATH: $${step3.napkin_math?.target_price ?? 0} target (${step3.napkin_math?.upside_percent ?? 0}% upside) vs ${step3.napkin_math?.comp_ticker ?? ''} at ${step3.napkin_math?.comp_multiple ?? 0}x

BEAR CASE: ${step4.bear_case ?? ''}
RISK FACTORS: ${(step4.risk_factors ?? []).join(' | ')}

MACRO: ${step5.macro_summary ?? ''}
SECTOR HEAT: ${step5.sector_heat ?? 3}/5 | MATCHED SECTORS: ${(step5.hot_sector_match ?? []).join(', ') || 'none'}
TARIFF: ${step5.tariff_exposure ?? ''}

SENTIMENT: ${step6.sentiment_summary ?? ''}
SHORT INTEREST: ${step6.short_interest ?? ''}
200-DAY MA: ${step6.ma_position ?? ''}
RS vs SPY: ${step6.rs_vs_spy ?? ''}`;

  emit({ step: 7, label: 'Synthesis & Diagram', status: 'started' });
  const startTime7 = Date.now();
  const text = await callClaude(
    system,
    `Synthesise a complete moat-finder report for ${ticker}.\n\n${contextSummary}\n\nReturn only the JSON object with "report" and "diagram" keys.`,
  );
  const duration7 = Date.now() - startTime7;

  const parsed = JSON.parse(extractJson(text)) as { report: ReportJson; diagram: DiagramJson };

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
    step_label: 'Synthesis & Diagram',
    output_json: { report: parsed.report as unknown as Record<string, unknown>, diagram: parsed.diagram as unknown as Record<string, unknown> },
    duration_ms: duration7,
  });

  emit({ step: 7, label: 'Synthesis & Diagram', status: 'complete', duration: duration7 });
  console.log(`[Step 7] complete — thesis: ${parsed.report.thesis.substring(0, 80)}, diagram nodes: ${(parsed.diagram?.nodes ?? []).length}, edges: ${(parsed.diagram?.edges ?? []).length} (${duration7}ms)`);
  return { report: parsed.report, diagram: parsed.diagram, runId };
}

// ─── Step defaults (used when a parallel step fails — Step 7 still runs) ──────

const DEFAULT_STEP2: Step2Output = { business_model: '', moat: '', technological_advantage: '', catalysts: [] };
const DEFAULT_STEP3: Step3Output = {
  valuation_table: [],
  napkin_math: { revenue_guidance: '', comp_ticker: '', comp_multiple: 0, target_price: 0, upside_percent: 0 },
  financial_summary: '',
};
const DEFAULT_STEP4: Step4Output = { bear_case: '', risk_factors: [], tail_risks: [] };
const DEFAULT_STEP5: Step5Output = { macro_summary: '', sector_heat: 3, hot_sector_match: [], tariff_exposure: '' };
const DEFAULT_STEP6: Step6Output = { sentiment_summary: '', short_interest: '', ma_position: '', rs_vs_spy: '' };

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
      emit({ step: stepNum, label, status: 'complete', resumed: true, duration: 0 });
      console.log(`[Step ${stepNum}] resumed from checkpoint`);
      return cachedSteps.get(stepNum) as T;
    }
    try {
      const result = await runner();
      await saveCheckpoint(ticker, runId, {
        step_number: stepNum,
        step_label: label,
        output_json: result as Record<string, unknown>,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : `Step ${stepNum} failed`;
      emit({ step: stepNum, label, status: 'error', data: { message } });
      console.warn(`[Step ${stepNum}] failed — using default. Reason: ${message}`);
      return defaultVal;
    }
  }

  const [step2, step3, step4, step5, step6] = await Promise.all([
    runOrResume(2, 'Deep Dive',              () => runStep2(step1, emit), DEFAULT_STEP2),
    runOrResume(3, 'Valuation & Financials', () => runStep3(step1, emit), DEFAULT_STEP3),
    runOrResume(4, 'Risk Red Team',          () => runStep4(step1, emit), DEFAULT_STEP4),
    runOrResume(5, 'Macro & Sector',         () => runStep5(step1, emit), DEFAULT_STEP5),
    runOrResume(6, 'Sentiment & Technicals', () => runStep6(step1, emit), DEFAULT_STEP6),
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
export async function runPipeline(ticker: string, emit: EmitFn): Promise<PipelineResult> {
  // Load existing checkpoints — resume in-progress run if present
  const existing = await loadCheckpoints(ticker);
  const runId = existing?.runId ?? randomUUID();
  const cachedSteps = existing?.steps ?? new Map<number, Record<string, unknown>>();

  if (cachedSteps.size > 0) {
    console.log(`[runPipeline] Resuming ${ticker} run ${runId} — cached steps: ${[...cachedSteps.keys()].sort((a, b) => a - b).join(', ')}`);
  }

  // Step 1 — Discovery (always fast; run fresh to get current company data)
  let step1: Step1Output;
  if (cachedSteps.has(1)) {
    step1 = cachedSteps.get(1) as unknown as Step1Output;
    emit({ step: 1, label: 'Discovery', status: 'complete', resumed: true, duration: 0 });
    console.log('[Step 1] resumed from checkpoint');
  } else {
    step1 = await runStep1(ticker, emit);
    await saveCheckpoint(ticker, runId, {
      step_number: 1,
      step_label: 'Discovery',
      output_json: step1 as unknown as Record<string, unknown>,
    });
  }

  const [step2, step3, step4, step5, step6] = await runParallelSteps(step1, ticker, runId, cachedSteps, emit);

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
    step_label: 'Discovery',
    output_json: step1 as unknown as Record<string, unknown>,
  });

  // Reconstruct step2/step4 from existing report — these are skipped
  const rawSteps = existingReport.pipeline_steps_raw;
  const rawStep2 = rawSteps['step2'] as Partial<Step2Output> | undefined;
  const rawStep4 = rawSteps['step4'] as Partial<Step4Output> | undefined;

  const cachedStep2: Step2Output = {
    business_model: existingReport.business_model ?? '',
    moat: existingReport.moat ?? '',
    technological_advantage: rawStep2?.technological_advantage ?? '',
    catalysts: existingReport.catalysts ?? [],
  };
  const cachedStep4: Step4Output = {
    bear_case: existingReport.bear_case ?? '',
    risk_factors: existingReport.risk_factors ?? [],
    tail_risks: (rawStep4?.tail_risks as string[] | undefined) ?? [],
  };

  emit({ step: 2, label: 'Deep Dive', status: 'cached', data: { message: 'Using previous research' } });
  emit({ step: 4, label: 'Risk Red Team', status: 'cached', data: { message: 'Using previous research' } });
  console.log('[Update] Steps 2 and 4 skipped — reusing cached data');

  // Run steps 3, 5, 6 in parallel with checkpoint saves
  const emptyCache = new Map<number, Record<string, unknown>>();
  const [, step3,, step5, step6] = await runParallelSteps(step1, ticker, runId, emptyCache, emit);

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
