import { describe, it, expect } from "vitest";
import { normPct } from "./normPct";

describe("normPct", () => {
  it("scales a decimal fraction up to a percentage", () => {
    expect(normPct(0.25)).toBe(25);
  });

  it("scales a negative decimal fraction up to a percentage", () => {
    expect(normPct(-0.15)).toBe(-15);
  });

  it("leaves an already-percentage value unchanged", () => {
    expect(normPct(39)).toBe(39);
  });

  it("leaves a large already-percentage value unchanged", () => {
    expect(normPct(150)).toBe(150);
  });

  it("treats zero as already a percentage", () => {
    expect(normPct(0)).toBe(0);
  });

  it("scales a value right at the 200% boundary (2.0 -> 200, kept as decimal path)", () => {
    // 2.0 * 100 = 200, which is not > 200, so it IS treated as a decimal.
    expect(normPct(2)).toBe(200);
  });

  it("treats a value just over the boundary as already a percentage", () => {
    // 2.01 * 100 = 201 > 200, so the raw value is used as-is.
    expect(normPct(2.01)).toBe(2.01);
  });
});
