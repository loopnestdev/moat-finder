/**
 * Normalise a decimal or already-percentage value to a display percentage.
 * `yoy_growth` and `gross_margin` fields may come back from the LLM as a
 * decimal (0.25) or already multiplied out (25). If multiplying by 100
 * gives an absurd result (>200%), the value was already a percentage.
 */
export function normPct(value: number): number {
  const asPct = value * 100;
  return Math.abs(asPct) > 200 ? value : asPct;
}
