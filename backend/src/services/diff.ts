import type { ReportJson, DiffJson } from '../types/report.types';

/**
 * Compare two ReportJson objects and produce a structured diff.
 * Score comparison requires the caller to pass the score values separately
 * because score lives on the research_reports row, not inside report_json.
 */
export function generateDiff(
  prev: ReportJson,
  prevScore: number | null,
  next: ReportJson,
  nextScore: number | null,
): DiffJson {
  const changedFields: string[] = [];

  // Compare scalar text fields
  const textFields = [
    'thesis',
    'business_model',
    'moat',
    'bear_case',
    'macro_summary',
    'sentiment_summary',
  ] as const;

  for (const field of textFields) {
    if (prev[field] !== next[field]) {
      changedFields.push(field);
    }
  }

  // Compare napkin_math as a whole (deep equality via JSON)
  if (JSON.stringify(prev.napkin_math) !== JSON.stringify(next.napkin_math)) {
    changedFields.push('napkin_math');
  }

  // Catalyst diff
  const prevSet = new Set(prev.catalysts);
  const nextSet = new Set(next.catalysts);
  const addedCatalysts = next.catalysts.filter((c) => !prevSet.has(c));
  const removedCatalysts = prev.catalysts.filter((c) => !nextSet.has(c));

  // Score diff
  const scoreDiff =
    prevScore !== nextScore ? { from: prevScore ?? 0, to: nextScore ?? 0 } : null;

  // Human-readable summary
  const parts: string[] = [];
  if (changedFields.length > 0) parts.push(`${changedFields.join(', ')} updated`);
  if (addedCatalysts.length > 0) parts.push(`${addedCatalysts.length} catalyst(s) added`);
  if (removedCatalysts.length > 0) parts.push(`${removedCatalysts.length} catalyst(s) removed`);
  if (scoreDiff) parts.push(`score changed from ${scoreDiff.from} to ${scoreDiff.to}`);

  return {
    score: scoreDiff,
    changed_fields: changedFields,
    added_catalysts: addedCatalysts,
    removed_catalysts: removedCatalysts,
    summary: parts.length > 0 ? parts.join('; ') : 'No changes',
  };
}
