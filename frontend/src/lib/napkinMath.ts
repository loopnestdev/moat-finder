import type {
  NapkinMath as NapkinMathType,
  PriceScenario,
  ValuationRow,
} from "../types/report.types";

export interface CompOption {
  key: string;
  ticker: string;
  multiple: number;
  targetPrice: number;
  upsidePercent: number;
  /** true when computed client-side by scaling a peer's P/S ratio, rather than returned directly by the LLM */
  estimated: boolean;
  scenarioLabel?: "Bear" | "Base" | "Bull";
}

const SCENARIO_ORDER: Record<string, number> = { Bear: 0, Base: 1, Bull: 2 };

/**
 * Builds the list of selectable comp options for the Napkin Math card:
 * 1. The LLM's own Bear/Base/Bull scenarios (authoritative numbers), sorted.
 * 2. A synthesised "Base" option from the primary napkin_math figures when
 *    no scenarios array exists at all (pre-v2 reports).
 * 3. Any other valuation-table peer not already covered by a scenario,
 *    extrapolated via P/S ratio scaling — marked `estimated: true`.
 *
 * The scaling assumes all scenarios apply their comp multiple to the same
 * revenue/share base (true by pipeline construction — verified empirically:
 * target_price / comp_multiple is constant across Bear/Base/Bull for a given
 * report). That constant `k` is then applied to any other peer's ps_ratio.
 */
export function buildCompOptions(
  data: NapkinMathType,
  scenarios: PriceScenario[] | undefined,
  valuationTable: ValuationRow[] | undefined,
  ticker: string,
): CompOption[] {
  const baseMultiple = data?.comp_multiple ?? 0;
  const baseTarget = data?.target_price ?? 0;
  const baseUpside = data?.upside_percent ?? 0;

  const k = baseMultiple !== 0 ? baseTarget / baseMultiple : 0;
  const upsideRatio = 1 + baseUpside / 100;
  const currentPrice = upsideRatio !== 0 ? baseTarget / upsideRatio : 0;

  const opts: CompOption[] = [];
  const seenTickers = new Set<string>();

  const sortedScenarios = [...(scenarios ?? [])].sort(
    (a, b) => (SCENARIO_ORDER[a.label] ?? 9) - (SCENARIO_ORDER[b.label] ?? 9),
  );
  for (const s of sortedScenarios) {
    opts.push({
      key: `scenario-${s.label}`,
      ticker: s.comp_ticker,
      multiple: s.comp_multiple,
      targetPrice: s.target_price,
      upsidePercent: s.upside_percent,
      estimated: false,
      scenarioLabel: s.label,
    });
    if (s.comp_ticker) seenTickers.add(s.comp_ticker.toUpperCase());
  }

  if (!sortedScenarios.some((s) => s.label === "Base")) {
    opts.unshift({
      key: "base-primary",
      ticker: data?.comp_ticker ?? "",
      multiple: baseMultiple,
      targetPrice: baseTarget,
      upsidePercent: baseUpside,
      estimated: false,
      scenarioLabel: "Base",
    });
    if (data?.comp_ticker) seenTickers.add(data.comp_ticker.toUpperCase());
  }

  for (const row of valuationTable ?? []) {
    const rowTicker = (row.ticker ?? "").toUpperCase();
    if (!rowTicker || rowTicker === ticker.toUpperCase()) continue;
    if (seenTickers.has(rowTicker)) continue;
    if (row.ps_ratio === null || k === 0 || currentPrice === 0) continue;
    const targetPrice = k * row.ps_ratio;
    const upsidePercent = (targetPrice / currentPrice - 1) * 100;
    opts.push({
      key: `peer-${rowTicker}`,
      ticker: row.ticker,
      multiple: row.ps_ratio,
      targetPrice,
      upsidePercent,
      estimated: true,
    });
    seenTickers.add(rowTicker);
  }

  return opts;
}
