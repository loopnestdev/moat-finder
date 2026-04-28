interface BearCaseProps {
  bearCase: string;
  riskFactors: string[];
}

/** Split bear case narrative into numbered points on sentence boundaries */
function splitToPoints(text: string): string[] {
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

export default function BearCase({
  bearCase,
  riskFactors = [],
}: BearCaseProps) {
  const points = splitToPoints(bearCase ?? "");

  return (
    <div className="rounded border-l-4 border-red-500 bg-[#0a0f1e] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4">
        <p className="font-mono text-xs text-red-400 uppercase tracking-widest">
          Bear Case
        </p>
      </div>

      {/* Numbered bear case points */}
      <div className="px-5 pb-4 space-y-4 border-b border-white/5">
        {points.map((point, i) => (
          <div key={i} className="flex gap-4">
            <span className="font-mono text-xl font-bold text-white/20 flex-shrink-0 leading-tight w-7">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="font-body text-sm text-slate-300 leading-relaxed">
              {point.replace(/\.$/, "")}.
            </p>
          </div>
        ))}
      </div>

      {/* Risk factors */}
      {riskFactors.length > 0 && (
        <div className="px-5 py-4 space-y-3">
          <p className="font-mono text-xs text-red-400 uppercase tracking-widest mb-3">
            Key Risks
          </p>
          {riskFactors.map((risk, i) => (
            <div
              key={i}
              className="flex gap-3 bg-[#111827] border-l-2 border-red-500 rounded-r px-3 py-2.5"
            >
              <WarningIcon />
              <p className="font-body text-sm text-slate-300 leading-relaxed">
                {risk}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
