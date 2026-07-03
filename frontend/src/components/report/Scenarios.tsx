import type { PriceScenario } from "../../types/report.types";

interface ScenariosProps {
  scenarios: PriceScenario[];
}

const LABEL_STYLES: Record<PriceScenario["label"], string> = {
  Bear: "text-red-400 border-red-500/40",
  Base: "text-gold border-gold/40",
  Bull: "text-emerald-400 border-emerald-500/40",
};

function fmtPrice(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

function fmtUpside(value: number | null): { text: string; colour: string } {
  if (value === null) return { text: "—", colour: "text-cream-subtle" };
  return {
    text: `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`,
    colour: value >= 0 ? "text-emerald-400" : "text-red-400",
  };
}

export default function Scenarios({ scenarios }: ScenariosProps) {
  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div className="rounded bg-navy-800 border border-navy-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-navy-700">
        <p className="font-mono text-xs text-gold/70 uppercase tracking-[0.2em]">
          Scenarios
        </p>
      </div>
      <div className="divide-y divide-navy-700/50">
        {scenarios.map((s) => {
          const upside = fmtUpside(s.upside_percent);
          return (
            <div key={s.label} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={[
                    "font-mono text-xs uppercase tracking-widest border-l-2 pl-2",
                    LABEL_STYLES[s.label],
                  ].join(" ")}
                >
                  {s.label}
                </span>
                <span className="font-mono text-sm text-cream">
                  {fmtPrice(s.target_price)}{" "}
                  <span className={upside.colour}>{upside.text}</span>
                </span>
              </div>
              <p className="font-mono text-[11px] text-cream-subtle mb-1.5">
                <span className="text-gold/80">{s.comp_ticker}</span>{" "}
                {s.comp_multiple}x
              </p>
              <p className="font-body text-xs text-cream-muted leading-relaxed">
                {s.rationale}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
