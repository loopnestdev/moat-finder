import { describe, it, expect } from 'vitest';
import { generateDiff } from '../src/services/diff';
import type { ReportJson } from '../src/types/report.types';

const base: ReportJson = {
  thesis: 'Strong long thesis',
  business_model: 'SaaS subscription',
  moat: 'High switching costs',
  competitors: [{ ticker: 'COMP', name: 'Competitor Inc' }],
  napkin_math: {
    revenue_guidance: '$100M ARR',
    comp_ticker: 'COMP',
    comp_multiple: 10,
    target_price: 50,
    upside_percent: 25,
  },
  bear_case: 'Competition risk from hyperscalers',
  sector_heat: 4,
  hot_sector_match: ['AI'],
  valuation_table: [],
  catalysts: ['Q2 earnings beat', 'New enterprise deal'],
  risk_factors: ['Customer concentration'],
  macro_summary: 'Positive tailwinds from AI spend',
  sentiment_summary: 'Bullish retail, neutral institutional',
  pipeline_steps_raw: {},
};

describe('generateDiff', () => {
  it('returns no changes when reports are identical', () => {
    const diff = generateDiff(base, 7.0, base, 7.0);
    expect(diff.changed_fields).toHaveLength(0);
    expect(diff.added_catalysts).toHaveLength(0);
    expect(diff.removed_catalysts).toHaveLength(0);
    expect(diff.score).toBeNull();
    expect(diff.summary).toBe('No changes');
  });

  it('detects a score change', () => {
    const diff = generateDiff(base, 7.0, base, 8.5);
    expect(diff.score).toEqual({ from: 7.0, to: 8.5 });
    expect(diff.summary).toContain('score changed');
  });

  it('handles null scores without error', () => {
    const diff = generateDiff(base, null, base, null);
    expect(diff.score).toBeNull();
  });

  it('detects a changed thesis', () => {
    const next = { ...base, thesis: 'Updated thesis with new information' };
    const diff = generateDiff(base, null, next, null);
    expect(diff.changed_fields).toContain('thesis');
    expect(diff.summary).not.toBe('No changes');
  });

  it('detects a changed bear_case', () => {
    const next = { ...base, bear_case: 'New bear case argument' };
    const diff = generateDiff(base, null, next, null);
    expect(diff.changed_fields).toContain('bear_case');
  });

  it('detects a changed napkin_math', () => {
    const next = {
      ...base,
      napkin_math: { ...base.napkin_math, target_price: 75, upside_percent: 88 },
    };
    const diff = generateDiff(base, null, next, null);
    expect(diff.changed_fields).toContain('napkin_math');
  });

  it('detects an added catalyst', () => {
    const next = { ...base, catalysts: [...base.catalysts, 'New product launch'] };
    const diff = generateDiff(base, null, next, null);
    expect(diff.added_catalysts).toEqual(['New product launch']);
    expect(diff.removed_catalysts).toHaveLength(0);
  });

  it('detects a removed catalyst', () => {
    const next = { ...base, catalysts: [base.catalysts[0] ?? ''] };
    const diff = generateDiff(base, null, next, null);
    expect(diff.removed_catalysts).toEqual([base.catalysts[1] ?? '']);
    expect(diff.added_catalysts).toHaveLength(0);
  });

  it('summary includes all change types when multiple fields change', () => {
    const next = {
      ...base,
      thesis: 'Changed thesis',
      catalysts: [...base.catalysts, 'Added catalyst'],
    };
    const diff = generateDiff(base, 7.0, next, 8.0);
    expect(diff.summary).toContain('thesis');
    expect(diff.summary).toContain('catalyst');
    expect(diff.summary).toContain('score');
  });
});
