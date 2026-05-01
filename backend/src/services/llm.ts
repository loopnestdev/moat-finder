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
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }
      return textBlock.text;
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

    // max_tokens or other — return whatever text we have
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") return textBlock.text;
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

/**
 * Robust JSON extractor — works for both Claude and Gemini responses.
 * Strips markdown fences, finds the outermost { } pair, and falls back to
 * repairJSON() when JSON.parse fails (e.g. response truncated at token limit).
 * Throws if no JSON object is found after repair — caller must catch.
 */
export function extractJSON(text: string): unknown {
  const stripped = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const start = stripped.indexOf("{");
  if (start === -1) {
    throw new Error(
      `No JSON object found in LLM response. Response length: ${text.length}. First 500 chars: ${text.substring(0, 500)}`,
    );
  }
  // Take from the first { to the last } (or end of string if response is cut off)
  const end = stripped.lastIndexOf("}");
  const jsonStr =
    end !== -1 ? stripped.substring(start, end + 1) : stripped.substring(start);

  try {
    return JSON.parse(jsonStr);
  } catch (firstError) {
    try {
      const repaired = repairJSON(jsonStr);
      console.warn(
        "[extractJSON] JSON repair attempted for truncated response",
      );
      return JSON.parse(repaired);
    } catch (repairError) {
      throw new Error(
        `No JSON object found in LLM response. ` +
          `Response length: ${text.length}. ` +
          `Parse error: ${firstError instanceof Error ? firstError.message : String(firstError)}. ` +
          `Repair also failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`,
      );
    }
  }
}
