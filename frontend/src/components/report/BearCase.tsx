interface BearCaseProps {
  bearCase: string;
  riskFactors: string[];
}

/** Split bear case narrative into numbered points on sentence boundaries */
function splitToPoints(text: string): string[] {
  // Split on ". " followed by a capital letter, or on numbered patterns like "1." / "2."
  const byNumber = text.split(/\s*\d+\.\s+/).filter(Boolean);
  if (byNumber.length >= 2) return byNumber;
  const bySentence = text.split(/\.\s+(?=[A-Z])/).filter(Boolean);
  return bySentence.length >= 2 ? bySentence : [text];
}

function WarningIcon() {
  return (
    <svg
      className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

export default function BearCase({ bearCase, riskFactors }: BearCaseProps) {
  const points = splitToPoints(bearCase);

  return (
    <div className="rounded-xl border border-red-900/50 bg-red-950/20 overflow-hidden">
      {/* Header */}
      <div className="border-l-4 border-red-500 px-5 py-4 bg-red-950/30">
        <p className="font-mono text-xs text-red-400 uppercase tracking-[0.2em]">
          Bear Case
        </p>
      </div>

      {/* Numbered bear case points */}
      <div className="px-5 py-4 space-y-4 border-b border-red-900/30">
        {points.map((point, i) => (
          <div key={i} className="flex gap-4">
            <span className="font-mono text-xl font-bold text-red-700/60 flex-shrink-0 leading-tight w-7">
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="font-body text-sm text-cream-muted leading-relaxed">
              {point.replace(/\.$/, '')}.
            </p>
          </div>
        ))}
      </div>

      {/* Risk factors */}
      {riskFactors.length > 0 && (
        <div className="px-5 py-4 space-y-3">
          <p className="font-mono text-xs text-red-400/70 uppercase tracking-widest mb-3">
            Risk Factors
          </p>
          {riskFactors.map((risk, i) => (
            <div key={i} className="flex gap-3">
              <WarningIcon />
              <p className="font-body text-sm text-cream-muted leading-relaxed">{risk}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
