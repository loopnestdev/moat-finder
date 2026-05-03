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
    "Ticker must be 1–14 characters (e.g. NVDA, EOS.AX, 7203.T)",
  );

export type TickerInput = z.infer<typeof tickerSchema>;
