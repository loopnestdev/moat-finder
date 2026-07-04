import { describe, it, expect } from "vitest";
import { buildCompOptions } from "./napkinMath";
import type {
  NapkinMath,
  PriceScenario,
  ValuationRow,
} from "../types/report.types";

const napkinMath: NapkinMath = {
  revenue_guidance: "$33.5B (Q3 FY2026 projection)",
  comp_ticker: "WDC",
  comp_multiple: 21.44,
  target_price: 2464.99,
  upside_percent: 116.23,
};

const scenarios: PriceScenario[] = [
  {
    label: "Bear",
    comp_ticker: "INTC",
    comp_multiple: 11.52,
    target_price: 1327.96,
    upside_percent: 16.49,
    rationale: "Mature peer",
  },
  {
    label: "Base",
    comp_ticker: "WDC",
    comp_multiple: 21.44,
    target_price: 2464.99,
    upside_percent: 116.23,
    rationale: "Median peer",
  },
  {
    label: "Bull",
    comp_ticker: "AMD",
    comp_multiple: 23.22,
    target_price: 2672.96,
    upside_percent: 134.47,
    rationale: "Hypergrowth peer",
  },
];

const valuationTable: ValuationRow[] = [
  { ticker: "MU", name: "Micron", ps_ratio: 10.9, ev_ebitda: 30.5, yoy_growth: 346, gross_margin: 84.9 },
  { ticker: "WDC", name: "Western Digital", ps_ratio: 2.9, ev_ebitda: 15.2, yoy_growth: 33, gross_margin: 32 },
  { ticker: "INTC", name: "Intel", ps_ratio: 2.6, ev_ebitda: 10.5, yoy_growth: 17, gross_margin: 41 },
  { ticker: "AMD", name: "AMD", ps_ratio: 10.5, ev_ebitda: 45, yoy_growth: 2, gross_margin: 52 },
];

describe("buildCompOptions", () => {
  it("orders scenarios Bear, Base, Bull regardless of input order", () => {
    const shuffled = [scenarios[2], scenarios[0], scenarios[1]];
    const opts = buildCompOptions(napkinMath, shuffled, [], "MU");
    expect(opts.map((o) => o.scenarioLabel)).toEqual(["Bear", "Base", "Bull"]);
  });

  it("uses the LLM's own scenario numbers directly (no client recomputation)", () => {
    const opts = buildCompOptions(napkinMath, scenarios, [], "MU");
    const bull = opts.find((o) => o.scenarioLabel === "Bull");
    expect(bull).toMatchObject({
      ticker: "AMD",
      targetPrice: 2672.96,
      upsidePercent: 134.47,
      estimated: false,
    });
  });

  it("excludes valuation-table peers already covered by a scenario", () => {
    // WDC, INTC, AMD are all scenario comps already — none should appear as "estimated" extras.
    const opts = buildCompOptions(napkinMath, scenarios, valuationTable, "MU");
    const estimated = opts.filter((o) => o.estimated);
    expect(estimated).toHaveLength(0);
  });

  it("excludes the subject's own ticker from the peer list", () => {
    const opts = buildCompOptions(napkinMath, [], valuationTable, "MU");
    expect(opts.some((o) => o.ticker === "MU")).toBe(false);
  });

  it("adds an estimated option for a valuation-table peer not covered by any scenario", () => {
    const extraPeer: ValuationRow = {
      ticker: "HSAI",
      name: "Hesai",
      ps_ratio: 4,
      ev_ebitda: null,
      yoy_growth: null,
      gross_margin: null,
    };
    const opts = buildCompOptions(
      napkinMath,
      scenarios,
      [...valuationTable, extraPeer],
      "MU",
    );
    const hsai = opts.find((o) => o.ticker === "HSAI");
    expect(hsai?.estimated).toBe(true);
    // k = 2464.99 / 21.44 ≈ 114.98; target = k * 4 ≈ 459.9
    expect(hsai?.targetPrice).toBeCloseTo(114.9808 * 4, 1);
  });

  it("skips a valuation-table peer with a null ps_ratio", () => {
    const nullPeer: ValuationRow = {
      ticker: "IVZ",
      name: "Invesco",
      ps_ratio: null,
      ev_ebitda: null,
      yoy_growth: null,
      gross_margin: null,
    };
    const opts = buildCompOptions(napkinMath, scenarios, [nullPeer], "MU");
    expect(opts.some((o) => o.ticker === "IVZ")).toBe(false);
  });

  it("falls back to a synthesised Base option when there is no scenarios array (pre-v2 reports)", () => {
    const opts = buildCompOptions(napkinMath, undefined, [], "MU");
    expect(opts).toHaveLength(1);
    expect(opts[0]).toMatchObject({
      scenarioLabel: "Base",
      ticker: "WDC",
      targetPrice: 2464.99,
    });
  });

  it("does not extrapolate peers when comp_multiple is zero (avoids division by zero)", () => {
    const zeroMultiple: NapkinMath = { ...napkinMath, comp_multiple: 0 };
    const peer: ValuationRow = {
      ticker: "HSAI",
      name: "Hesai",
      ps_ratio: 4,
      ev_ebitda: null,
      yoy_growth: null,
      gross_margin: null,
    };
    const opts = buildCompOptions(zeroMultiple, scenarios, [peer], "MU");
    expect(opts.some((o) => o.ticker === "HSAI")).toBe(false);
  });

  it("is case-insensitive when matching the subject ticker and scenario comps", () => {
    const opts = buildCompOptions(napkinMath, scenarios, valuationTable, "mu");
    expect(opts.some((o) => o.ticker === "MU")).toBe(false);
  });
});
