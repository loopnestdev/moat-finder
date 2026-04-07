import { z } from 'zod';

export const tickerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,10}$/, 'Ticker must be 1–10 uppercase letters');

export type TickerInput = z.infer<typeof tickerSchema>;
