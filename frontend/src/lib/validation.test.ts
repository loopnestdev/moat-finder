import { describe, it, expect } from "vitest";
import { tickerSchema } from "./validation";

describe("tickerSchema", () => {
  it("accepts a plain US ticker", () => {
    expect(tickerSchema.parse("NVDA")).toBe("NVDA");
  });

  it("normalises lowercase input to uppercase", () => {
    expect(tickerSchema.parse("aapl")).toBe("AAPL");
  });

  it("trims surrounding whitespace", () => {
    expect(tickerSchema.parse("  skyt  ")).toBe("SKYT");
  });

  it("accepts an international ticker with an exchange suffix", () => {
    expect(tickerSchema.parse("eos.ax")).toBe("EOS.AX");
  });

  it("accepts a numeric Japanese ticker", () => {
    expect(tickerSchema.parse("7203.t")).toBe("7203.T");
  });

  it("accepts a Korean ticker with a numeric symbol", () => {
    expect(tickerSchema.parse("005930.ks")).toBe("005930.KS");
  });

  it("rejects an empty string", () => {
    expect(() => tickerSchema.parse("")).toThrow();
  });

  it("rejects a ticker longer than 10 characters before the suffix", () => {
    expect(() => tickerSchema.parse("TOOLONGTICKERNAME")).toThrow();
  });

  it("rejects a suffix longer than 3 letters", () => {
    expect(() => tickerSchema.parse("ABCD.LONG")).toThrow();
  });

  it("rejects special characters other than the exchange dot", () => {
    expect(() => tickerSchema.parse("BRK#A")).toThrow();
  });
});
