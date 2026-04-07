import { z } from 'zod';

/** Accepts 1–10 uppercase letters only (A-Z). Trims and uppercases input first. */
export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,10}$/, 'Ticker must be 1–10 uppercase letters');

/**
 * Validate and normalise a ticker symbol.
 * Normalisation: trims whitespace and converts to uppercase.
 * Validation: 1–10 uppercase letters only.
 */
export function validateTicker(symbol: string): { valid: boolean; normalised: string } {
  const result = tickerSchema.safeParse(symbol);
  if (result.success) {
    return { valid: true, normalised: result.data };
  }
  return { valid: false, normalised: symbol.trim().toUpperCase() };
}
