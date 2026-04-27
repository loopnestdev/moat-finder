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
      max_tokens: 8192,
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
    systemInstruction: BASE_SYSTEM,
  });

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const currentPrompt =
      attempt > 1
        ? prompt +
          "\n\nIMPORTANT: You MUST return a valid JSON object. Do not return empty text."
        : prompt;
    const result = await model.generateContent(currentPrompt);
    const text = result.response.text();
    if (text && text.trim().length > 0) return text;
    console.warn(
      `[Gemini] Empty response on attempt ${attempt}/${maxAttempts}, retrying...`,
    );
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
 * Robust JSON extractor — works for both Claude and Gemini responses.
 * Strips markdown fences then finds the outermost { } pair.
 * Throws if no JSON object is found — caller must catch.
 */
export function extractJSON(text: string): unknown {
  const stripped = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(
      `No JSON object found in LLM response. Response length: ${text.length}. First 500 chars: ${text.substring(0, 500)}`,
    );
  }
  return JSON.parse(stripped.substring(start, end + 1));
}
