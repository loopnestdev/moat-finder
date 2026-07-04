import { useMemo, useState } from "react";
import type {
  NapkinMath as NapkinMathType,
  PriceScenario,
  ValuationRow,
} from "../../types/report.types";
import { buildCompOptions } from "../../lib/napkinMath";

interface NapkinMathProps {
  data: NapkinMathType;
  scenarios?: PriceScenario[];
  valuationTable?: ValuationRow[];
  ticker: string;
}

/**
 * Extract the key dollar figure(s) from a revenue guidance string.
 * Matches patterns like "$330M", "$330-340M", "$1.2B", "330M-340M".
 * Returns null if nothing found.
 */
function extractGuideNumbers(guidance: string): string | null {
  const match = guidance.match(
    /\$?[\d,.]+\s*[BMKbmk]?\s*[-–]\s*\$?[\d,.]+\s*[BMKbmk]|\$[\d,.]+\s*[BMKbmk]/i,
  );
  return match ? match[0].trim() : null;
}

export default function NapkinMath({
  data,
  scenarios,
  valuationTable,
  ticker,
}: NapkinMathProps) {
  const baseMultiple = data?.comp_multiple ?? 0;
  const baseTarget = data?.target_price ?? 0;
  const baseUpside = data?.upside_percent ?? 0;

  const options = useMemo(
    () => buildCompOptions(data, scenarios, valuationTable, ticker),
    [data, scenarios, valuationTable, ticker],
  );

  const defaultKey =
    options.find((o) => o.scenarioLabel === "Base")?.key ??
    options[0]?.key ??
    "";
  const [selectedKey, setSelectedKey] = useState(defaultKey);

  const selected =
    options.find((o) => o.key === selectedKey) ?? options[0];

  const targetPrice = selected?.targetPrice ?? baseTarget;
  const upsidePercent = selected?.upsidePercent ?? baseUpside;
  const compTicker = selected?.ticker ?? data?.comp_ticker ?? "";
  const compMultiple = selected?.multiple ?? baseMultiple;
  const isEstimated = selected?.estimated ?? false;

  const upsidePositive = upsidePercent >= 0;
  const guideKey = extractGuideNumbers(data?.revenue_guidance ?? "");

  return (
    <div className="rounded bg-navy-950 border border-navy-700 p-5 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-5">
        <p className="font-mono text-xs text-gold/60 uppercase tracking-[0.2em]">
          Napkin Math
        </p>
        {options.length > 1 && (
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            aria-label="Compare against"
            className="rounded border border-navy-700 bg-navy-800 text-cream font-mono text-[11px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple focus:border-purple"
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.scenarioLabel ? `${o.scenarioLabel} — ` : ""}
                {o.ticker || "—"}
                {o.estimated ? " (est.)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Hero: target price + upside stacked vertically */}
      <div className="flex flex-col gap-2 mb-6">
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">
            Target Price
          </p>
          <p className="font-mono text-3xl font-bold text-gold leading-none">
            ${targetPrice.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">Upside</p>
          <p
            className={[
              "font-mono text-3xl font-bold leading-none",
              upsidePositive ? "text-emerald-400" : "text-red-400",
            ].join(" ")}
          >
            {upsidePositive ? "+" : ""}
            {upsidePercent.toFixed(1)}%
          </p>
        </div>
        {isEstimated && (
          <p className="font-body text-xs text-cream-subtle italic leading-snug">
            Estimated by scaling {compTicker}&rsquo;s P/S ratio against the
            Base scenario — not independently computed by the AI.
          </p>
        )}
      </div>

      {/* Supporting data */}
      <div className="grid grid-cols-2 gap-4 border-t border-navy-700 pt-4">
        {/* Revenue guidance — key figure prominent, full text below */}
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">
            Revenue Guidance
          </p>
          {guideKey ? (
            <>
              <p className="font-mono text-xl font-bold text-gold leading-tight mb-1">
                {guideKey}
              </p>
              <p className="font-body text-sm text-cream-subtle leading-snug">
                {data?.revenue_guidance ?? ""}
              </p>
            </>
          ) : (
            <p className="font-body text-sm text-cream leading-snug">
              {data?.revenue_guidance ?? ""}
            </p>
          )}
        </div>

        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">
            Comp Multiple
          </p>
          <p className="font-mono text-sm text-cream">
            <span className="text-gold">{compTicker}</span>{" "}
            <span className="text-cream-muted">
              {compMultiple.toFixed(2)}x
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
