import type { QuarterlyResult } from "../../types/report.types";

interface QuarterlyResultsProps {
  results?: QuarterlyResult[];
}

function fmtRevenue(val: number | null): string {
  if (val === null) return "—";
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(1)}B`;
  return `$${val.toFixed(0)}M`;
}

function fmtEps(val: number | null): string {
  if (val === null) return "—";
  return `$${val.toFixed(2)}`;
}

function fmtPct(val: number | null): { text: string; colour: string } {
  if (val === null) return { text: "—", colour: "text-cream-subtle" };
  const sign = val >= 0 ? "+" : "";
  return {
    text: `${sign}${val.toFixed(1)}%`,
    colour: val >= 0 ? "text-emerald-400" : "text-red-400",
  };
}

function beatMiss(
  est: number | null,
  act: number | null,
): { text: string; colour: string } | null {
  if (est === null || act === null || est === 0) return null;
  const pct = ((act - est) / Math.abs(est)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}% vs est`,
    colour: pct >= 0 ? "text-emerald-400" : "text-red-400",
  };
}

export default function QuarterlyResults({ results }: QuarterlyResultsProps) {
  return (
    <div className="rounded-xl bg-navy-950 border border-navy-700 overflow-hidden w-full min-w-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <p className="font-mono text-xs text-gold/60 uppercase tracking-[0.2em]">
          Quarterly Results
        </p>
        <p className="font-body text-[11px] text-cream-subtle mt-0.5">
          Last 4 quarters
        </p>
        <div className="mt-2.5 border-t border-gold/40" />
      </div>

      {/* Content */}
      {!results || results.length === 0 ? (
        <p className="px-4 pb-4 font-body text-sm text-cream-muted italic">
          Quarterly data not available for this report. Run an update to fetch
          latest figures.
        </p>
      ) : (
        <div className="divide-y divide-navy-700/50">
          {results.map((r, i) => {
            const revBeat = beatMiss(r.revenue_est, r.revenue_act);
            const epsBeat = beatMiss(r.eps_est, r.eps_act);
            const revGrowth = fmtPct(r.revenue_growth);

            return (
              <div
                key={r.quarter}
                className={["px-4 py-3", i === 0 ? "bg-navy-900/60" : ""].join(
                  " ",
                )}
              >
                {/* Quarter label */}
                <p className="font-mono text-xs font-bold text-cream mb-2">
                  {r.quarter}
                  {i === 0 && (
                    <span className="ml-2 font-mono text-[10px] text-gold/60 font-normal">
                      latest
                    </span>
                  )}
                </p>

                {/* Revenue row */}
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="font-mono text-[10px] text-cream-subtle uppercase w-14 flex-shrink-0">
                    Rev
                  </span>
                  <span className="font-mono text-xs text-cream-muted opacity-60">
                    {fmtRevenue(r.revenue_est)}
                  </span>
                  <span className="font-mono text-[10px] text-cream-subtle">
                    →
                  </span>
                  <span className="font-mono text-xs text-cream font-medium">
                    {fmtRevenue(r.revenue_act)}
                  </span>
                  {revBeat && (
                    <span
                      className={`font-mono text-[10px] ml-auto ${revBeat.colour}`}
                    >
                      {revBeat.text}
                    </span>
                  )}
                </div>

                {/* YoY growth row */}
                {r.revenue_growth !== null && (
                  <div className="flex items-baseline gap-1.5 mb-1 pl-[3.75rem]">
                    <span className="font-mono text-[10px] text-cream-subtle">
                      YoY
                    </span>
                    <span
                      className={`font-mono text-xs font-medium ${revGrowth.colour}`}
                    >
                      {revGrowth.text}
                    </span>
                  </div>
                )}

                {/* EPS row */}
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[10px] text-cream-subtle uppercase w-14 flex-shrink-0">
                    EPS
                  </span>
                  <span className="font-mono text-xs text-cream-muted opacity-60">
                    {fmtEps(r.eps_est)}
                  </span>
                  <span className="font-mono text-[10px] text-cream-subtle">
                    →
                  </span>
                  <span className="font-mono text-xs text-cream font-medium">
                    {fmtEps(r.eps_act)}
                  </span>
                  {epsBeat && (
                    <span
                      className={`font-mono text-[10px] ml-auto ${epsBeat.colour}`}
                    >
                      {epsBeat.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
