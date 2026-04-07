import { describe, it, expect } from 'vitest';
import { validateTicker, tickerSchema } from '../src/utils/ticker';

describe('validateTicker', () => {
  it('accepts single valid uppercase ticker', () => {
    expect(validateTicker('AAPL')).toEqual({ valid: true, normalised: 'AAPL' });
  });

  it('accepts a 3-letter ticker', () => {
    expect(validateTicker('BRK')).toEqual({ valid: true, normalised: 'BRK' });
  });

  it('accepts a 10-letter ticker (max length)', () => {
    expect(validateTicker('ABCDEFGHIJ')).toEqual({ valid: true, normalised: 'ABCDEFGHIJ' });
  });

  it('normalises lowercase input to uppercase', () => {
    expect(validateTicker('aapl')).toEqual({ valid: true, normalised: 'AAPL' });
  });

  it('trims surrounding whitespace and normalises', () => {
    expect(validateTicker('  aapl  ')).toEqual({ valid: true, normalised: 'AAPL' });
  });

  it('rejects empty string', () => {
    const result = validateTicker('');
    expect(result.valid).toBe(false);
  });

  it('rejects ticker longer than 10 characters', () => {
    expect(validateTicker('TOOLONGTICKER').valid).toBe(false);
  });

  it('rejects ticker containing digits', () => {
    expect(validateTicker('A1B').valid).toBe(false);
  });

  it('rejects ticker with special characters', () => {
    expect(validateTicker('BRK.A').valid).toBe(false);
  });

  it('returns a normalised value even when invalid', () => {
    const result = validateTicker('  brk.a  ');
    expect(result.valid).toBe(false);
    expect(result.normalised).toBe('BRK.A');
  });
});

describe('tickerSchema (Zod)', () => {
  it('parses a valid uppercase ticker', () => {
    expect(tickerSchema.parse('MSFT')).toBe('MSFT');
  });

  it('normalises lowercase to uppercase', () => {
    expect(tickerSchema.parse('msft')).toBe('MSFT');
  });

  it('trims and normalises padded input', () => {
    expect(tickerSchema.parse('  skyt  ')).toBe('SKYT');
  });

  it('throws for a ticker with digits', () => {
    expect(() => tickerSchema.parse('123')).toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => tickerSchema.parse('')).toThrow();
  });

  it('throws for a ticker exceeding 10 characters', () => {
    expect(() => tickerSchema.parse('TOOLONGTICKER')).toThrow();
  });
});
