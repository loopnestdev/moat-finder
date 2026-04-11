import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmitFn } from '../src/types/report.types';

// ─── Mock Anthropic SDK ───────────────────────────────────────────────────────

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { runPipeline } from '../src/services/pipeline';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const step1Json = JSON.stringify({
  company_name: 'Test Corp',
  industry: 'Software',
  sector: 'Technology',
  competitors: [{ ticker: 'COMP', name: 'Competitor' }],
  customers: ['Enterprise A'],
  primary_product: 'Cloud platform',
  primary_region: 'North America',
});

const step2Json = JSON.stringify({
  business_model: 'Subscription SaaS',
  moat: 'High switching costs',
  technological_advantage: 'Proprietary ML models',
  catalysts: ['New product launch', 'Q3 earnings'],
});

const step3Json = JSON.stringify({
  valuation_table: [{ ticker: 'COMP', name: 'Competitor', ps_ratio: 10, ev_ebitda: null, gross_margin: 0.7, yoy_growth: 0.25 }],
  napkin_math: { revenue_guidance: '$200M', comp_ticker: 'COMP', comp_multiple: 10, target_price: 50, upside_percent: 30 },
  financial_summary: 'Healthy growth trajectory',
});

const step4Json = JSON.stringify({
  bear_case: 'Hyperscaler competition could erode margins',
  risk_factors: ['Customer concentration', 'Regulatory risk'],
  tail_risks: ['Market recession'],
});

const step5Json = JSON.stringify({
  macro_summary: 'AI tailwinds positive',
  sector_heat: 4,
  hot_sector_match: ['AI'],
  tariff_exposure: 'Minimal',
});

const step6Json = JSON.stringify({
  sentiment_summary: 'Bullish retail sentiment',
  short_interest: '5% of float',
  ma_position: 'Above 200-day MA by 15%',
  rs_vs_spy: 'Outperforming SPY by 20% over 3 months',
});

const step7Json = JSON.stringify({
  report: {
    thesis: 'Strong AI play with durable moat',
    business_model: 'Subscription SaaS',
    moat: 'High switching costs',
    competitors: [{ ticker: 'COMP', name: 'Competitor' }],
    napkin_math: { revenue_guidance: '$200M', comp_ticker: 'COMP', comp_multiple: 10, target_price: 50, upside_percent: 30 },
    bear_case: 'Hyperscaler risk',
    sector_heat: 4,
    hot_sector_match: ['AI'],
    valuation_table: [],
    catalysts: ['New product launch'],
    risk_factors: ['Customer concentration'],
    macro_summary: 'AI tailwinds positive',
    sentiment_summary: 'Bullish',
    pipeline_steps_raw: {},
  },
  diagram: {
    nodes: [
      { id: '1', type: 'revenue', data: { label: 'SaaS Revenue', detail: '$200M ARR' }, position: { x: 0, y: 0 } },
      { id: '2', type: 'customer', data: { label: 'Enterprise A' }, position: { x: 600, y: 0 } },
    ],
    edges: [{ id: 'e1', source: '1', target: '2', label: 'serves' }],
  },
});

function makeEndTurnResponse(text: string) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
  };
}

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('emits started + complete SSE events for each step and returns a PipelineResult', async () => {
    mockCreate
      .mockResolvedValueOnce(makeEndTurnResponse(step1Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step2Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step3Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step4Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step5Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step6Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step7Json));

    const events: ReturnType<EmitFn extends (e: infer E) => unknown ? () => E : never>[] = [];
    const emit: EmitFn = (e) => { events.push(e); };

    const result = await runPipeline('TEST', emit);

    const completeEvents = events.filter((e) => e.status === 'complete');
    const startedEvents = events.filter((e) => e.status === 'started');

    expect(startedEvents).toHaveLength(7);
    expect(completeEvents).toHaveLength(7);
    expect(completeEvents.map((e) => e.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.report.thesis).toBe('Strong AI play with durable moat');
    expect(result.diagram.nodes).toHaveLength(2);
  });

  it('handles tool_use stop_reason by looping until end_turn', async () => {
    // First call returns tool_use, second returns end_turn
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tool-1', name: 'web_search', input: {} }],
      })
      .mockResolvedValueOnce(makeEndTurnResponse(step1Json))
      // Remaining 6 steps
      .mockResolvedValueOnce(makeEndTurnResponse(step2Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step3Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step4Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step5Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step6Json))
      .mockResolvedValueOnce(makeEndTurnResponse(step7Json));

    const emit: EmitFn = vi.fn();
    await runPipeline('TEST', emit);

    // create was called 8 times (step1 needed 2 calls, steps 2–7 each 1 call)
    expect(mockCreate).toHaveBeenCalledTimes(8);
  });

  it('throws when a step returns non-JSON text', async () => {
    mockCreate.mockResolvedValueOnce(makeEndTurnResponse('This is not JSON at all'));

    const emit: EmitFn = vi.fn();
    await expect(runPipeline('TEST', emit)).rejects.toThrow();
  });

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const emit: EmitFn = vi.fn();
    await expect(runPipeline('TEST', emit)).rejects.toThrow('ANTHROPIC_API_KEY not set');
  });
});
