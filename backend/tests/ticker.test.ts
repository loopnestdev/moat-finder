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

  it('accepts ticker containing digits (international tickers, e.g. Tokyo/Korea)', () => {
    expect(validateTicker('A1B')).toEqual({ valid: true, normalised: 'A1B' });
  });

  it('accepts a dot-suffixed ticker (exchange suffix, e.g. BRK.A / EOS.AX)', () => {
    expect(validateTicker('BRK.A')).toEqual({ valid: true, normalised: 'BRK.A' });
  });

  it('rejects a ticker with a suffix longer than 3 letters', () => {
    expect(validateTicker('ABCD.LONG').valid).toBe(false);
  });

  it('rejects ticker with invalid special characters', () => {
    expect(validateTicker('BRK#A').valid).toBe(false);
  });

  it('normalises lowercase dot-suffixed input even when invalid', () => {
    const result = validateTicker('  toolongticker.long  ');
    expect(result.valid).toBe(false);
    expect(result.normalised).toBe('TOOLONGTICKER.LONG');
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

  it('accepts a purely numeric ticker (e.g. Japanese/Korean exchange codes)', () => {
    expect(tickerSchema.parse('7203')).toBe('7203');
  });

  it('accepts a numeric ticker with an exchange suffix', () => {
    expect(tickerSchema.parse('7203.t')).toBe('7203.T');
  });

  it('throws for an empty string', () => {
    expect(() => tickerSchema.parse('')).toThrow();
  });

  it('throws for a ticker exceeding 10 characters', () => {
    expect(() => tickerSchema.parse('TOOLONGTICKER')).toThrow();
  });
});
