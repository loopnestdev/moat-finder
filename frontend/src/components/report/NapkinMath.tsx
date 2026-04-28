import type { NapkinMath as NapkinMathType } from "../../types/report.types";

interface NapkinMathProps {
  data: NapkinMathType;
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

export default function NapkinMath({ data }: NapkinMathProps) {
  const upsidePositive = data.upside_percent >= 0;
  const guideKey = extractGuideNumbers(data.revenue_guidance);

  return (
    <div className="rounded bg-navy-950 border border-navy-700 p-5 sm:p-6 overflow-hidden">
      <p className="font-mono text-xs text-gold/60 uppercase tracking-[0.2em] mb-5">
        Napkin Math
      </p>

      {/* Hero: target price + upside stacked vertically */}
      <div className="flex flex-col gap-2 mb-6">
        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">
            Target Price
          </p>
          <p className="font-mono text-3xl font-bold text-gold leading-none">
            ${data.target_price}
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
            {data.upside_percent}%
          </p>
        </div>
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
                {data.revenue_guidance}
              </p>
            </>
          ) : (
            <p className="font-body text-sm text-cream leading-snug">
              {data.revenue_guidance}
            </p>
          )}
        </div>

        <div>
          <p className="font-mono text-xs text-cream-subtle mb-1">
            Comp Multiple
          </p>
          <p className="font-mono text-sm text-cream">
            <span className="text-gold">{data.comp_ticker}</span>{" "}
            <span className="text-cream-muted">{data.comp_multiple}x</span>
          </p>
        </div>
      </div>
    </div>
  );
}
