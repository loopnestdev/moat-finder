/**
 * Parse a paragraph into numbered segments.
 * Tries "(1) …" / "1. …" patterns first; falls back to single-item array.
 */
export function parseNumberedList(text: string): string[] {
  // Pattern: (1) or (2) … anywhere in the string
  const byParen = text.split(/\s*\(\d+\)\s*/).filter(Boolean);
  if (byParen.length >= 2) return byParen;

  // Pattern: standalone "1. " / "2. " at start of segment
  const byDot = text.split(/(?:^|\s)\d+\.\s+/).filter(Boolean);
  if (byDot.length >= 2) return byDot;

  return [text];
}

/**
 * Parse a moat string into clean numbered points for consistent rendering.
 * Returns a single-element array for plain prose (no numbering applied).
 */
export function parseMoatPoints(moat: string): string[] {
  if (!moat) return [];

  // Try pattern: (1) text; (2) text; (3) text
  const parenPattern = moat.match(/\(\d+\)\s+[^(]+/g);
  if (parenPattern && parenPattern.length >= 2) {
    return parenPattern
      .map((p) =>
        p
          .replace(/^\(\d+\)\s+/, "")
          .replace(/;\s*$/, "")
          .trim(),
      )
      .filter(Boolean);
  }

  // Try pattern: 1. text\n2. text
  const dotPattern = moat.split(/\n\d+\.\s+/).filter(Boolean);
  if (dotPattern.length >= 2) {
    return dotPattern.map((p) => p.trim());
  }

  // Try semicolon separation (must start with capital or open-paren)
  const semiPattern = moat.split(/;\s+(?=[A-Z(])/);
  if (semiPattern.length >= 2) {
    return semiPattern.map((p) => p.trim()).filter((p) => p.length > 20);
  }

  // Fallback: return as single paragraph
  return [moat];
}

/**
 * Parse a paragraph into labelled bullets.
 * Sentences containing a colon get the pre-colon text treated as a bold label.
 * Otherwise the text is split by ". " into plain bullets.
 */
export function parseBullets(
  text: string,
): Array<{ label: string | null; body: string }> {
  // Split into sentences on ". " followed by a capital letter
  const sentences = text.split(/\.\s+(?=[A-Z])/).filter(Boolean);

  const bullets = sentences.map((s) => {
    const colonIdx = s.indexOf(":");
    if (colonIdx > 0 && colonIdx < 60) {
      return {
        label: s.slice(0, colonIdx).trim(),
        body: s.slice(colonIdx + 1).trim(),
      };
    }
    return { label: null, body: s.replace(/\.$/, "").trim() };
  });

  return bullets.filter((b) => b.body.length > 0);
}
