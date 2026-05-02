import { useState } from "react";
import type { ResearchVersion } from "../../types/report.types";

interface ChangelogProps {
  versions: ResearchVersion[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Changelog({ versions = [] }: ChangelogProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (versions.length === 0) return null;

  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-3">
      {sorted.map((v) => {
        const isExpanded = expanded === v.id;
        const diff = v.diff_json;

        return (
          <div
            key={v.id}
            className="rounded-lg border border-amber-400/20 bg-navy-900 overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : v.id)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-navy-800 transition-colors"
              aria-expanded={isExpanded}
            >
              <span className="flex-shrink-0 font-mono text-xs bg-amber-400/10 text-amber-400 border border-amber-400/30 px-2 py-1 rounded mt-0.5">
                v{v.version}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-body text-sm font-medium text-cream">
                    {formatDate(v.created_at)}
                  </span>
                  {v.score !== null && (
                    <span className="font-mono text-sm text-amber-400">
                      Score: {v.score.toFixed(1)}
                    </span>
                  )}
                </div>
                {diff?.summary && (
                  <p className="font-body text-sm text-cream-muted mt-0.5 truncate">
                    {diff.summary}
                  </p>
                )}
              </div>
              <span className="text-amber-400/60 flex-shrink-0">
                {isExpanded ? "▲" : "▼"}
              </span>
            </button>

            {isExpanded && diff && (
              <div className="border-t border-amber-400/10 bg-navy-950 px-4 py-3 space-y-3 text-sm">
                {diff.score && (
                  <div>
                    <span className="font-body font-medium text-cream/80">
                      Score:{" "}
                    </span>
                    <span className="font-mono text-amber-400">
                      {diff.score.from?.toFixed(1) ?? "N/A"} →{" "}
                      {diff.score.to?.toFixed(1) ?? "N/A"}
                    </span>
                  </div>
                )}
                {diff.target_price && (
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <span className="text-slate-400">Target:</span>
                    <span className="font-mono text-slate-400 line-through text-xs">
                      ${diff.target_price.from?.toFixed(2) ?? "—"}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="font-mono text-amber-400 font-semibold">
                      ${diff.target_price.to?.toFixed(2) ?? "—"}
                    </span>
                    {diff.target_price.upside_to != null && (
                      <span
                        className={
                          diff.target_price.upside_to >= 0
                            ? "text-emerald-400 font-mono text-sm font-semibold"
                            : "text-red-400 font-mono text-sm font-semibold"
                        }
                      >
                        ({diff.target_price.upside_to >= 0 ? "+" : ""}
                        {diff.target_price.upside_to?.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                )}
                {(diff.changed_fields ?? []).length > 0 && (
                  <div>
                    <span className="font-body font-medium text-cream/80">
                      Updated:{" "}
                    </span>
                    <span className="font-body text-cream-muted">
                      {(diff.changed_fields ?? []).join(", ")}
                    </span>
                  </div>
                )}
                {(diff.added_catalysts ?? []).length > 0 && (
                  <div>
                    <span className="font-body font-medium text-emerald-400">
                      Added catalysts:{" "}
                    </span>
                    <ul className="list-disc list-inside text-emerald-400 mt-1">
                      {(diff.added_catalysts ?? []).map((c, i) => (
                        <li key={i} className="font-body text-cream-muted">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(diff.removed_catalysts ?? []).length > 0 && (
                  <div>
                    <span className="font-body font-medium text-red-400">
                      Removed catalysts:{" "}
                    </span>
                    <ul className="list-disc list-inside text-red-400 mt-1">
                      {(diff.removed_catalysts ?? []).map((c, i) => (
                        <li key={i} className="font-body text-cream-muted">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
