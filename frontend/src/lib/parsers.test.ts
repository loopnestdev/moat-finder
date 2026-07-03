import { describe, it, expect } from "vitest";
import { parseNumberedList, parseMoatPoints, parseBullets } from "./parsers";

describe("parseNumberedList", () => {
  it("splits on parenthetical numbering", () => {
    const text = "(1) First point (2) Second point (3) Third point";
    expect(parseNumberedList(text)).toEqual([
      "First point",
      "Second point",
      "Third point",
    ]);
  });

  it("splits on dotted numbering", () => {
    const text = "1. First point 2. Second point";
    expect(parseNumberedList(text)).toEqual(["First point", "Second point"]);
  });

  it("returns the whole string as a single item when no numbering is present", () => {
    const text = "Just a plain paragraph with no numbering at all.";
    expect(parseNumberedList(text)).toEqual([text]);
  });

  it("returns a single item for a lone numbered entry", () => {
    const text = "(1) Only one point";
    expect(parseNumberedList(text)).toEqual([text]);
  });
});

describe("parseMoatPoints", () => {
  it("returns an empty array for an empty string", () => {
    expect(parseMoatPoints("")).toEqual([]);
  });

  it("splits on parenthetical numbering and strips markers", () => {
    const text = "(1) High switching costs; (2) Network effects; (3) Brand";
    expect(parseMoatPoints(text)).toEqual([
      "High switching costs",
      "Network effects",
      "Brand",
    ]);
  });

  it("splits on newline-dot numbering (leading marker on the first segment is not stripped)", () => {
    const text = "1. High switching costs\n2. Network effects";
    expect(parseMoatPoints(text)).toEqual([
      "1. High switching costs",
      "Network effects",
    ]);
  });

  it("splits on semicolons when segments are long enough and capitalised", () => {
    const text =
      "Strong network effects driven by two-sided marketplace dynamics; Significant switching costs from deep enterprise integrations";
    const result = parseMoatPoints(text);
    expect(result.length).toBe(2);
  });

  it("falls back to a single paragraph when no pattern matches", () => {
    const text = "A short moat description with no clear delimiters";
    expect(parseMoatPoints(text)).toEqual([text]);
  });
});

describe("parseBullets", () => {
  it("splits sentences and extracts a colon-delimited label", () => {
    const text =
      "Regulation: New tariffs could raise costs. Demand: Consumer spending remains resilient.";
    const result = parseBullets(text);
    expect(result).toEqual([
      { label: "Regulation", body: "New tariffs could raise costs" },
      { label: "Demand", body: "Consumer spending remains resilient." },
    ]);
  });

  it("returns a null label when no colon is present", () => {
    const text = "This is a plain sentence with no label at all";
    const result = parseBullets(text);
    expect(result).toEqual([{ label: null, body: text }]);
  });

  it("ignores colons that appear too far into the sentence", () => {
    const text =
      "This is a very long sentence that happens to contain a colon way past the sixty character label cutoff: like this";
    const result = parseBullets(text);
    expect(result[0]?.label).toBeNull();
  });

  it("filters out empty bullets", () => {
    expect(parseBullets("")).toEqual([]);
  });
});
