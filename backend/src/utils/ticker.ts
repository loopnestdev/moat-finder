import { z } from "zod";

/**
 * Accepts 1–10 alphanumeric chars with an optional exchange suffix (dot + 1–3 letters).
 * Examples: NVDA, EOS.AX, 7203.T, 005930.KS, SAP.DE
 * Trims and uppercases input first.
 */
export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9]{1,10}(\.[A-Z]{1,3})?$/,
    "Ticker must be 1–14 characters (e.g. NVDA, EOS.AX, 7203.T, 005930.KS)",
  );

/**
 * Validate and normalise a ticker symbol.
 * Normalisation: trims whitespace, converts to uppercase, preserves dot suffix.
 * Validation: 1–10 alphanumeric chars + optional .SUFFIX (1–3 letters).
 */
export function validateTicker(symbol: string): {
  valid: boolean;
  normalised: string;
} {
  const result = tickerSchema.safeParse(symbol);
  if (result.success) {
    return { valid: true, normalised: result.data };
  }
  return { valid: false, normalised: symbol.trim().toUpperCase() };
}
