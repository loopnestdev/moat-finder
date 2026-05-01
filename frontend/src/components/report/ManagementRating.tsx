import type { ManagementRating as ManagementRatingType } from "../../types/report.types";

interface ManagementRatingProps {
  data: ManagementRatingType;
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

export default function ManagementRating({ data }: ManagementRatingProps) {
  const g = gradeClasses(data.grade);

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
            {data.grade?.toUpperCase() ?? "N/A"}
          </span>
        </div>
        <div>
          <p className={`font-mono text-2xl font-bold leading-none ${g.text}`}>
            {data.score}
            <span className="text-base font-normal text-cream-subtle">
              /100
            </span>
          </p>
          <p className="font-body text-sm text-cream-muted mt-1 leading-snug">
            {data.summary}
          </p>
        </div>
      </div>

      {/* Detail rows */}
      <div className="space-y-3 border-t border-navy-700 pt-4">
        <div>
          <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
            CEO Assessment
          </p>
          <p className="font-body text-sm text-cream-muted leading-snug">
            {data.ceo_assessment}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
            Recent Changes
          </p>
          <p className="font-body text-sm text-cream-muted leading-snug">
            {data.recent_changes}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-cream-subtle uppercase tracking-[0.15em] mb-1">
            Capital Allocation
          </p>
          <p className="font-body text-sm text-cream-muted leading-snug">
            {data.capital_allocation}
          </p>
        </div>
      </div>
    </div>
  );
}
