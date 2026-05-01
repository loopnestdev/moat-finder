import type { ManagementRating as ManagementRatingType } from "../../types/report.types";

interface ManagementRatingProps {
  data: ManagementRatingType | null | undefined;
}

function gradeClasses(grade: string | null | undefined): {
  text: string;
  border: string;
  bg: string;
} {
  switch (grade) {
    case "A":
      return {
        text: "text-emerald-400",
        border: "border-emerald-500/40",
        bg: "bg-emerald-500/10",
      };
    case "B":
      return {
        text: "text-sky-400",
        border: "border-sky-500/40",
        bg: "bg-sky-500/10",
      };
    case "C":
      return {
        text: "text-amber-400",
        border: "border-amber-500/40",
        bg: "bg-amber-500/10",
      };
    case "D":
      return {
        text: "text-orange-400",
        border: "border-orange-500/40",
        bg: "bg-orange-500/10",
      };
    case "F":
      return {
        text: "text-red-400",
        border: "border-red-500/40",
        bg: "bg-red-500/10",
      };
    default:
      return {
        text: "text-cream-subtle",
        border: "border-navy-700",
        bg: "bg-navy-800",
      };
  }
}

export default function ManagementRating({
  data: rating,
}: ManagementRatingProps) {
  if (!rating) {
    return (
      <div className="rounded bg-navy-950 border border-navy-700 p-5">
        <p className="font-mono text-xs text-cream-subtle/60 uppercase tracking-[0.2em] mb-2">
          Management Quality
        </p>
        <p className="font-body text-sm text-cream-subtle">
          Management rating not available. Run Update Research to generate this
          analysis.
        </p>
      </div>
    );
  }

  const g = gradeClasses(rating?.grade);
  const isSchemaA = !!rating?.categories;
  const totalScore = rating?.total_score ?? rating?.score ?? 0;

  return (
    <div className="rounded bg-navy-950 border border-navy-700 p-5 overflow-hidden">
      {/* Header */}
      <div className="mb-4">
        <p className="font-mono text-xs text-cream-subtle/60 uppercase tracking-[0.2em]">
          Management Quality
        </p>
        <p className="font-body text-xs text-cream-subtle italic mt-0.5">
          Independent assessment — not included in investment score
        </p>
      </div>

      {/* Grade + score hero */}
      <div className="flex items-center gap-4 mb-5">
        <div
          className={`flex items-center justify-center w-14 h-14 rounded border ${g.border} ${g.bg} flex-shrink-0`}
        >
          <span
            className={`font-mono text-3xl font-bold leading-none ${g.text}`}
          >
            {rating?.grade?.toUpperCase() ?? "N/A"}
          </span>
        </div>
        <div>
          <p className={`font-mono text-2xl font-bold leading-none ${g.text}`}>
            {totalScore}
            <span className="text-base font-normal text-cream-subtle">
              /100
            </span>
          </p>
          {rating?.summary && (
            <p className="font-body text-sm text-cream-muted mt-1 leading-snug">
              {rating.summary}
            </p>
          )}
        </div>
      </div>

      {/* Schema A: 5-category breakdown with progress bars */}
      {isSchemaA && rating?.categories && (
        <div className="space-y-3 border-t border-navy-700 pt-4">
          {(
            [
              { key: "say_do_ratio", label: "Say-Do Ratio", defaultMax: 30 },
              { key: "communication", label: "Communication", defaultMax: 20 },
              {
                key: "capital_discipline",
                label: "Capital Discipline",
                defaultMax: 25,
              },
              {
                key: "insider_alignment",
                label: "Insider Alignment",
                defaultMax: 15,
              },
              {
                key: "strategic_focus",
                label: "Strategic Focus",
                defaultMax: 10,
              },
            ] as const
          ).map(({ key, label, defaultMax }) => {
            const cat = rating.categories?.[key];
            const score = cat?.score ?? 0;
            const catMax = cat?.max ?? defaultMax;
            const pct = catMax > 0 ? Math.round((score / catMax) * 100) : 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em]">
                    {label}
                  </p>
                  <span className="font-mono text-xs text-cream-muted">
                    {score}/{catMax}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-navy-700 overflow-hidden">
                  {/* Dynamic percentage width requires inline style — Tailwind cannot express runtime values */}
                  <div
                    className="h-full rounded-full bg-purple/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {cat?.evidence && (
                  <p className="font-body text-xs text-cream-subtle/70 mt-0.5 leading-snug">
                    {cat.evidence}
                  </p>
                )}
              </div>
            );
          })}

          {/* Key person */}
          {(rating?.key_person ?? rating?.ceo_assessment) && (
            <div className="pt-1">
              <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
                Key Person
              </p>
              <p className="font-body text-sm text-cream-muted leading-snug">
                {rating?.key_person ?? rating?.ceo_assessment}
              </p>
            </div>
          )}

          {/* Green flags */}
          {(rating?.green_flags ?? []).length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
                Green Flags
              </p>
              <ul className="space-y-0.5">
                {(rating.green_flags ?? []).map((flag, i) => (
                  <li
                    key={i}
                    className="font-body text-xs text-emerald-400/80 leading-snug"
                  >
                    ✓ {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Red flags */}
          {(rating?.red_flags ?? []).length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
                Red Flags
              </p>
              <ul className="space-y-0.5">
                {(rating.red_flags ?? []).map((flag, i) => (
                  <li
                    key={i}
                    className="font-body text-xs text-red-400/80 leading-snug"
                  >
                    ✗ {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Schema B: simplified view (legacy Gemini format) */}
      {!isSchemaA && (
        <div className="space-y-3 border-t border-navy-700 pt-4">
          {rating?.ceo_assessment && (
            <div>
              <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
                CEO Assessment
              </p>
              <p className="font-body text-sm text-cream-muted leading-snug">
                {rating.ceo_assessment}
              </p>
            </div>
          )}
          {rating?.capital_allocation && (
            <div>
              <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
                Capital Allocation
              </p>
              <p className="font-body text-sm text-cream-muted leading-snug">
                {rating.capital_allocation}
              </p>
            </div>
          )}
          {rating?.recent_changes && (
            <div>
              <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
                Recent Changes
              </p>
              <p className="font-body text-sm text-cream-muted leading-snug">
                {rating.recent_changes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
