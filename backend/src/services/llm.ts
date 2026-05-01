import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type LLMProvider = "claude" | "gemini";

export interface LLMResponse {
  text: string;
  provider: LLMProvider;
  model: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const BASE_SYSTEM =
  "You must respond with ONLY a valid JSON object when asked for JSON. " +
  "No preamble, no explanation, no markdown code blocks. " +
  "Start your response with { and end with }";

const GEMINI_SYSTEM = `You are a financial research AI assistant with real-time web search capability via googleSearch tool.

MANDATORY RULES — NEVER VIOLATE THESE:
1. ALWAYS call googleSearch BEFORE answering any question about stocks, companies, financials, markets, or current events
2. NEVER refuse a research task — always search and respond
3. NEVER say you cannot access the internet — you have googleSearch
4. NEVER say your knowledge is limited — search for current data
5. ALWAYS respond with ONLY a valid JSON object when instructed to
6. Start JSON response with { and end with }
7. Use null for any field where data is unavailable after searching
8. NEVER include prose, apologies, or explanations outside the JSON`;

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API key not configured on server");
  return new GoogleGenerativeAI(apiKey);
}

// ─── Claude call with web_search tool loop ───────────────────────────────────

async function runClaude(prompt: string): Promise<string> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  for (;;) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system: BASE_SYSTEM,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });

    if (
      response.stop_reason === "end_turn" ||
      response.stop_reason === "stop_sequence"
    ) {
      // Use LAST non-trivial text block — Claude emits text both BEFORE and
      // AFTER web_search calls, so joining all blocks contaminates the JSON
      // with pre-search prose. The final answer is always the last block.
      const textBlocks = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
        .map((b) => b.text)
        .filter((t) => t.trim().length > 10);

      const rawText =
        textBlocks.length > 0 ? textBlocks[textBlocks.length - 1] : "";

      if (!rawText || rawText.trim().length === 0) {
        throw new Error("No text content in Claude response");
      }
      return rawText;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use",
      );
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: toolUseBlocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: "",
        })),
      });
      continue;
    }

    // max_tokens or other — return whatever text we have (last non-empty block)
    const fallbackBlocks = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .filter((t) => t.trim().length > 0);
    const fallbackText =
      fallbackBlocks.length > 0
        ? fallbackBlocks[fallbackBlocks.length - 1]
        : "";
    if (fallbackText) return fallbackText;
    throw new Error(`Unexpected stop_reason: ${String(response.stop_reason)}`);
  }
}

// ─── Gemini call with Google Search grounding ─────────────────────────────────

async function runGemini(
  prompt: string,
  useSearch: boolean = true,
): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: useSearch ? [{ googleSearch: {} } as any] : [],
    systemInstruction: GEMINI_SYSTEM,
  });

  const generationConfig = { temperature: 0.1, maxOutputTokens: 16384 };
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const currentPrompt =
      attempt > 1
        ? prompt +
          "\n\nIMPORTANT: You MUST return a valid JSON object. Do not return empty text."
        : prompt;
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: currentPrompt }] }],
        generationConfig,
      });
      const text = result.response.text();
      if (text && text.trim().length > 10) return text;
      console.warn(
        `[Gemini] Empty/short response on attempt ${attempt}/${maxAttempts}, retrying...`,
      );
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes("503") && attempt < maxAttempts) {
        console.warn(`[Gemini] 503 on attempt ${attempt}, retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `Gemini returned empty response after ${maxAttempts} attempts`,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function callLLM(
  prompt: string,
  provider?: LLMProvider,
  useSearch: boolean = true,
): Promise<LLMResponse> {
  const resolvedProvider: LLMProvider =
    provider ??
    (process.env.DEFAULT_LLM as LLMProvider | undefined) ??
    "claude";

  if (resolvedProvider === "gemini") {
    const text = await runGemini(prompt, useSearch);
    return { text, provider: resolvedProvider, model: GEMINI_MODEL };
  }

  const text = await runClaude(prompt);
  return { text, provider: resolvedProvider, model: CLAUDE_MODEL };
}

/**
 * Best-effort repair for truncated JSON — closes any unclosed arrays/objects
 * and strips trailing incomplete values left by a token-limit cut-off.
 */
function repairJSON(text: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let repaired = text.trimEnd();
  // Remove trailing comma or partial key/string left by the cut-off
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/,\s*"[^"]*$/, "");
  // Close every unclosed structure in reverse order
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  return repaired;
}

/** Known field names from any pipeline step — used to detect single-key envelope wrapping. */
const STEP_FIELDS = new Set([
  // Synthesis / top-level report
  "thesis",
  "moat",
  "score",
  "bear_case",
  "catalysts",
  "business_model",
  // Step 2 (Deep Dive)
  "management_rating",
  "competitive_moat",
  "technology_assessment",
  // Step 3 (Valuation)
  "napkin_math",
  "valuation_table",
  "quarterly_results",
  "financial_summary",
  // Step 4 (Risk Red Team)
  "risk_factors",
  "short_thesis",
  // Step 5 (Macro)
  "macro_summary",
  "sector_heat",
  "policy_risk",
  // Step 6 (Sentiment)
  "sentiment_summary",
  "technical_signals",
  "short_interest",
]);

/**
 * Strip a single-key envelope wrapper that Claude/Gemini occasionally adds
 * despite being instructed not to:
 *   {"report": {"thesis": "..."}} → {"thesis": "..."}
 *   {"deep_dive": {"moat": "..."}} → {"moat": "..."}
 * Only unwraps when the inner object contains at least one known step field.
 */
function unwrapEnvelope(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const keys = Object.keys(value);
  if (keys.length !== 1) return value;

  const inner = (value as Record<string, unknown>)[keys[0]];
  if (inner === null || typeof inner !== "object" || Array.isArray(inner)) {
    return value;
  }

  const innerKeys = Object.keys(inner);
  if (innerKeys.some((k) => STEP_FIELDS.has(k))) {
    console.warn(`[extractJSON] Unwrapping single-key envelope: "${keys[0]}"`);
    return inner;
  }
  return value;
}

/**
 * Robust JSON extractor — handles BOM, {variable} prose, multiple text blocks,
 * truncated JSON, and trailing prose. Accepts an optional provider string for
 * richer error messages. Throws on failure — caller must catch.
 */
export function extractJSON(text: string, provider?: string): unknown {
  if (!text || text.trim().length === 0) {
    throw new Error(
      `LLM returned empty response. Provider: ${provider ?? "unknown"}`,
    );
  }

  // Strip BOM + markdown code fences
  const cleaned = text
    .replace(/^﻿/, "")
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  // Find the FIRST { that is a valid JSON object start:
  //   Valid: { then optional whitespace then " (property) or } (empty obj)
  //   Invalid: {WORD} {ticker} {variable} — these have a non-space char after {
  const realObjectRegex = /\{[\t\n\r ]*["}\[]/g;
  const matchResult = realObjectRegex.exec(cleaned);
  const start = matchResult ? matchResult.index : -1;

  if (start === -1) {
    throw new Error(
      `No JSON object found in LLM response. ` +
        `Provider: ${provider ?? "unknown"}. ` +
        `Length: ${text.length}. ` +
        `First 300 chars: ${text.substring(0, 300)}`,
    );
  }

  // Find the matching closing brace by tracking depth
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  // If depth tracking failed (e.g. truncated response), fall back to lastIndexOf
  if (end === -1) end = cleaned.lastIndexOf("}");

  if (end === -1 || end <= start) {
    throw new Error(
      `Malformed JSON in LLM response (no closing brace). ` +
        `Provider: ${provider ?? "unknown"}. Length: ${text.length}`,
    );
  }

  const jsonStr = cleaned.substring(start, end + 1);

  try {
    return unwrapEnvelope(JSON.parse(jsonStr));
  } catch (firstError) {
    try {
      const repaired = repairJSON(jsonStr);
      console.warn(
        `[extractJSON] Repair applied. Provider: ${provider ?? "unknown"}. ` +
          `Original error: ${(firstError as Error).message}`,
      );
      return unwrapEnvelope(JSON.parse(repaired));
    } catch (repairError) {
      throw new Error(
        `JSON parse failed. Provider: ${provider ?? "unknown"}. ` +
          `Length: ${text.length}. ` +
          `Parse error: ${(firstError as Error).message}. ` +
          `Repair error: ${(repairError as Error).message}. ` +
          `JSON preview (first 200): ${jsonStr.substring(0, 200)}`,
      );
    }
  }
}
