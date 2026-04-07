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

/**
 * Call Claude with web search enabled.
 * web_search_20250305 is a server-side tool — Anthropic executes the search
 * automatically and returns the final answer in a single response.
 * A fallback loop handles the rare case where stop_reason is 'tool_use'
 * for any client-side tools that might be added in future.
 */
async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const client = createAnthropicClient();
  const messages: MessageParam[] = [{ role: 'user', content: userMessage }];

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

  const text = await callClaude(
    system,
    `Research the company with ticker symbol ${ticker}.
Identify: company name, industry, top 3 competitors (with their tickers), top 3 known customers,
primary product/service, and primary operating region.
Use web search for current information. Return only the JSON object.`,
  );

  const result = JSON.parse(extractJson(text)) as Step1Output;
  emit({ step: 1, label: 'Discovery', status: 'complete', data: { company_name: result.company_name } });
  return result;
}

async function runStep2(ctx: Pick<PipelineContext, 'step1'>, emit: EmitFn): Promise<Step2Output> {
  const { step1 } = ctx;
  const system = `You are a financial research analyst specialising in competitive moat analysis.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "business_model": "string",
  "moat": "string",
  "technological_advantage": "string",
  "catalysts": ["string"]
}`;

  const text = await callClaude(
    system,
    `Company: ${step1.company_name} (${step1.primary_product}, ${step1.industry})
Competitors: ${step1.competitors.map((c) => `${c.name} (${c.ticker})`).join(', ')}

Perform a deep dive analysis:
1. How does the company make money (business model)?
2. What is the economic moat (switching costs, network effects, IP, cost advantages)?
3. What is the technological advantage over competitors?
4. List 3–5 upcoming catalysts over the next 12 months.

Use web search for current information. Return only the JSON object.`,
  );

  const result = JSON.parse(extractJson(text)) as Step2Output;
  emit({ step: 2, label: 'Deep Dive', status: 'complete' });
  return result;
}

async function runStep3(
  ctx: Pick<PipelineContext, 'step1' | 'step2'>,
  emit: EmitFn,
): Promise<Step3Output> {
  const { step1, step2 } = ctx;
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
  "financial_summary": "string"
}
Use null (not "null") for unknown numeric values.`;

  const text = await callClaude(
    system,
    `Company: ${step1.company_name}
Competitors: ${step1.competitors.map((c) => `${c.name} (${c.ticker})`).join(', ')}
Moat: ${step2.moat}

Provide:
1. Relative valuation table vs 2–3 competitors: P/S, EV/EBITDA, gross margin, YoY revenue growth
2. Napkin math: revenue guidance, best comparable ticker, their multiple, implied target price, upside %
3. Brief financial summary (2–3 sentences)

Use web search for current financials. Return only the JSON object.`,
  );

  const result = JSON.parse(extractJson(text)) as Step3Output;
  emit({ step: 3, label: 'Valuation & Financials', status: 'complete' });
  return result;
}

async function runStep4(
  ctx: Pick<PipelineContext, 'step1' | 'step2' | 'step3'>,
  emit: EmitFn,
): Promise<Step4Output> {
  const { step1, step2, step3 } = ctx;
  const system = `You are a bearish research analyst performing a risk red team analysis.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "bear_case": "string",
  "risk_factors": ["string", "string", "string"],
  "tail_risks": ["string", "string"]
}`;

  const text = await callClaude(
    system,
    `Company: ${step1.company_name} (${step1.industry})
Moat claimed: ${step2.moat}
Valuation upside: ${step3.napkin_math.upside_percent}%

Perform a risk red team (bear case):
1. Bear case — write it as a short seller would (3-point thesis on why this fails)
2. Top 3 risk factors from SEC filings and recent analyst reports
3. Two tail risks (low probability, high impact scenarios)

Use web search for current short theses and risk disclosures. Return only the JSON object.`,
  );

  const result = JSON.parse(extractJson(text)) as Step4Output;
  emit({ step: 4, label: 'Risk Red Team', status: 'complete' });
  return result;
}

async function runStep5(ctx: Pick<PipelineContext, 'step1'>, emit: EmitFn): Promise<Step5Output> {
  const { step1 } = ctx;
  const system = `You are a macro and sector analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "macro_summary": "string",
  "sector_heat": integer_1_to_5,
  "hot_sector_match": ["string"],
  "tariff_exposure": "string"
}
sector_heat must be an integer 1–5 (1=cold, 5=very hot). hot_sector_match must be a subset of the provided hot sectors list.`;

  const text = await callClaude(
    system,
    `Company: ${step1.company_name}
Industry: ${step1.industry} | Sector: ${step1.sector} | Region: ${step1.primary_region}
Hot sectors to evaluate against: ${HOT_SECTORS.join(', ')}

Analyse:
1. Macro tailwinds and headwinds (Fed policy, rates, tariffs, government spending)
2. Sector heat score 1–5 (how hot is this sector right now?)
3. Which of the hot sectors does this company match? (list only those that apply, or empty array)
4. Tariff and supply chain exposure

Use web search for current macro context. Return only the JSON object.`,
  );

  const result = JSON.parse(extractJson(text)) as Step5Output;
  emit({ step: 5, label: 'Macro & Sector', status: 'complete' });
  return result;
}

async function runStep6(ctx: Pick<PipelineContext, 'step1'>, emit: EmitFn): Promise<Step6Output> {
  const { step1 } = ctx;
  const system = `You are a technical and sentiment analyst.
Respond ONLY with a valid JSON object matching exactly this structure. No markdown, no explanation:
{
  "sentiment_summary": "string",
  "short_interest": "string",
  "ma_position": "string",
  "rs_vs_spy": "string"
}`;

  const text = await callClaude(
    system,
    `Company: ${step1.company_name}

Analyse current market sentiment and technicals:
1. Overall sentiment summary (retail + institutional)
2. Short interest (% of float, recent changes)
3. Position vs 200-day moving average (above/below, by how much %)
4. Relative strength vs SPY over last 3 months (outperforming/underperforming by X%)

Use web search for current market data. Return only the JSON object.`,
  );

  const result = JSON.parse(extractJson(text)) as Step6Output;
  emit({ step: 6, label: 'Sentiment & Technicals', status: 'complete' });
  return result;
}

async function runStep7(
  ctx: PipelineContext,
  ticker: string,
  emit: EmitFn,
): Promise<PipelineResult> {
  const { step1, step2, step3, step4, step5, step6 } = ctx;

  const system = `You are a senior investment analyst synthesising a complete research report.
Respond ONLY with a valid JSON object with exactly two keys: "report" and "diagram".
No markdown, no explanation, raw JSON only.

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
COMPETITORS: ${step1.competitors.map((c) => `${c.name} (${c.ticker})`).join(', ')}
TOP CUSTOMERS: ${step1.customers.join(', ')}

BUSINESS MODEL: ${step2.business_model}
MOAT: ${step2.moat}
TECH ADVANTAGE: ${step2.technological_advantage}
CATALYSTS: ${step2.catalysts.join(' | ')}

VALUATION SUMMARY: ${step3.financial_summary}
NAPKIN MATH: $${step3.napkin_math.target_price} target (${step3.napkin_math.upside_percent}% upside) vs ${step3.napkin_math.comp_ticker} at ${step3.napkin_math.comp_multiple}x

BEAR CASE: ${step4.bear_case}
RISK FACTORS: ${step4.risk_factors.join(' | ')}

MACRO: ${step5.macro_summary}
SECTOR HEAT: ${step5.sector_heat}/5 | MATCHED SECTORS: ${step5.hot_sector_match.join(', ') || 'none'}
TARIFF: ${step5.tariff_exposure}

SENTIMENT: ${step6.sentiment_summary}
SHORT INTEREST: ${step6.short_interest}
200-DAY MA: ${step6.ma_position}
RS vs SPY: ${step6.rs_vs_spy}`;

  const text = await callClaude(
    system,
    `Synthesise a complete moat-finder report for ${ticker}.\n\n${contextSummary}\n\nReturn only the JSON object with "report" and "diagram" keys.`,
  );

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

  emit({ step: 7, label: 'Synthesis & Diagram', status: 'complete' });
  return { report: parsed.report, diagram: parsed.diagram };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full 7-step research pipeline sequentially.
 * Each step emits an SSE event on completion.
 * Each step's output is passed as context to the next.
 */
export async function runPipeline(ticker: string, emit: EmitFn): Promise<PipelineResult> {
  const step1 = await runStep1(ticker, emit);
  const step2 = await runStep2({ step1 }, emit);
  const step3 = await runStep3({ step1, step2 }, emit);
  const step4 = await runStep4({ step1, step2, step3 }, emit);
  const step5 = await runStep5({ step1 }, emit);
  const step6 = await runStep6({ step1 }, emit);
  const ctx: PipelineContext = { step1, step2, step3, step4, step5, step6 };
  return runStep7(ctx, ticker, emit);
}
