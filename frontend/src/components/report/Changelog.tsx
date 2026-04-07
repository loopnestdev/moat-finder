import { useState } from 'react';
import type { ResearchVersion } from '../../types/report.types';

interface ChangelogProps {
  versions: ResearchVersion[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Changelog({ versions }: ChangelogProps) {
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
            className="rounded-lg border border-gray-200 bg-white overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : v.id)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              aria-expanded={isExpanded}
            >
              <span className="flex-shrink-0 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded mt-0.5">
                v{v.version}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(v.created_at)}
                  </span>
                  {v.score !== null && (
                    <span className="text-sm text-gray-600">
                      Score: {v.score.toFixed(1)}
                    </span>
                  )}
                </div>
                {diff?.summary && (
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {diff.summary}
                  </p>
                )}
              </div>
              <span className="text-gray-400 flex-shrink-0">
                {isExpanded ? '▲' : '▼'}
              </span>
            </button>

            {isExpanded && diff && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3 text-sm">
                {diff.score && (
                  <div>
                    <span className="font-medium text-gray-700">Score: </span>
                    <span className="text-gray-600">
                      {diff.score.from?.toFixed(1) ?? 'N/A'} →{' '}
                      {diff.score.to?.toFixed(1) ?? 'N/A'}
                    </span>
                  </div>
                )}
                {diff.changed_fields.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Updated: </span>
                    <span className="text-gray-600">
                      {diff.changed_fields.join(', ')}
                    </span>
                  </div>
                )}
                {diff.added_catalysts.length > 0 && (
                  <div>
                    <span className="font-medium text-emerald-700">
                      Added catalysts:{' '}
                    </span>
                    <ul className="list-disc list-inside text-gray-600 mt-1">
                      {diff.added_catalysts.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diff.removed_catalysts.length > 0 && (
                  <div>
                    <span className="font-medium text-red-700">
                      Removed catalysts:{' '}
                    </span>
                    <ul className="list-disc list-inside text-gray-600 mt-1">
                      {diff.removed_catalysts.map((c, i) => (
                        <li key={i}>{c}</li>
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
