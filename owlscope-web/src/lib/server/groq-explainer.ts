import "server-only";

/**
 * OwlScope Phase 3 - Groq AI Explanation Layer
 * ------------------------------------------------------------
 * ARCHITECTURE RULE: the deterministic Risk Engine (risk-engine.ts) is
 * the SOLE authority for score, level, confidence, and factors. This
 * module NEVER recalculates, alters, or overrides any of that - it
 * only converts already-decided facts into professional prose.
 *
 * If Groq is unavailable, times out, returns invalid JSON, or its
 * output fails validation/guardrail checks, this module falls back to
 * a deterministic (non-AI) template explanation so the product still
 * works end-to-end without an API key.
 * ------------------------------------------------------------
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 8000;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface DeterministicRiskSummary {
  overallRiskScore: number | null;
  overallRiskLabel: "Low" | "Medium" | "High" | "Unknown";
  confidence: number;
  findings: string[]; // factual bullets, already produced by risk-engine.ts
  caveats: string[]; // known data limitations, already produced by risk-engine.ts
}

export interface GroqExplanation {
  headline: string;
  summary: string;
  key_findings: string[];
  limitations: string[];
  provider: string; // "groq" or "deterministic_fallback"
  model: string;
  generated_at: string;
}

// Words/phrases that must never appear in an AI explanation - if the
// model's output contains any of these, we discard it and use the
// deterministic fallback instead of risking financial-advice language
// or invented specifics.
// Terms that must NEVER appear at all, regardless of context - pure
// trading-advice or unearned-classification vocabulary with no
// legitimate use in a v1 intelligence report.
const STRICT_FORBIDDEN_PATTERNS: RegExp[] = [
  /\bbuy\b/i,
  /\bsell\b/i,
  // Advice-framed "hold" only - NOT the plain possession verb, which
  // is normal, necessary research language (e.g. "wallets hold 23% of supply").
  /\b(should|recommend(s|ed)?|advise[sd]?)\s+(you\s+)?(to\s+)?hold\b/i,
  /\bhold\s+(onto|on to)\b/i,
  /\bentry\b/i,
  /\btarget price\b/i,
  /\bprice target\b/i,
  /\bmoon(ing)?\b/i,
  /\b\d+x\b/i, // "100x", "10x" style predictions
  /\bguaranteed?\b/i,
  /\bwhale\b/i, // engine v1 never classifies any account this way - banned outright
];

// Terms that ARE legitimate when used to state a limitation/absence of
// data (which we explicitly require the AI to do), but must be blocked
// if used to assert an actual claim/value we never gave it.
const CONTEXTUAL_TERMS = ["liquidity", "volume", "wallet history", "developer behavior", "rug pull"];

const NEGATION_WINDOW = 60; // characters of context checked around each occurrence
const SAFE_CONTEXT_PATTERN =
  /\b(not|no|unavailable|lack(ing)?|missing|absent|cannot be|can not be|not yet|not currently|not evaluated|not assessed|not determined|undetermined|has not been|is not|are not|were not|n\/a)\b/i;

function findUnsafeContextualUsage(text: string): string | null {
  for (const term of CONTEXTUAL_TERMS) {
    const regex = new RegExp(`\\b${term.replace(" ", "\\s+")}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - NEGATION_WINDOW);
      const end = Math.min(text.length, match.index + term.length + NEGATION_WINDOW);
      const window = text.slice(start, end);
      if (!SAFE_CONTEXT_PATTERN.test(window)) {
        return term; // used as an assertion, not a stated limitation - unsafe
      }
    }
  }
  return null;
}

function containsForbiddenLanguage(text: string): string | null {
  for (const pattern of STRICT_FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return pattern.source;
    }
  }
  const unsafeContextual = findUnsafeContextualUsage(text);
  if (unsafeContextual) {
    return `"${unsafeContextual}" used outside a stated-limitation context`;
  }
  return null;
}

function validateGroqShape(obj: unknown): obj is Omit<GroqExplanation, "provider" | "model" | "generated_at"> {
  if (!obj || typeof obj !== "object") return false;
  const candidate = obj as Record<string, unknown>;
  if (typeof candidate.headline !== "string" || candidate.headline.trim() === "") return false;
  if (typeof candidate.summary !== "string" || candidate.summary.trim() === "") return false;
  if (!Array.isArray(candidate.key_findings) || !candidate.key_findings.every((f: unknown) => typeof f === "string")) return false;
  if (!Array.isArray(candidate.limitations) || !candidate.limitations.every((f: unknown) => typeof f === "string")) return false;
  return true;
}

/**
 * Builds a professional, deterministic (non-AI) explanation directly
 * from the risk engine's own output. Used whenever Groq is unavailable
 * or its output is rejected. This is not a degraded experience - it's
 * the same facts, worded plainly.
 */
function buildFallbackExplanation(input: DeterministicRiskSummary): GroqExplanation {
  const levelPhrase =
    input.overallRiskLabel === "Unknown"
      ? "Risk level could not be determined"
      : `${input.overallRiskLabel} protocol-level risk detected`;

  const scorePhrase =
    input.overallRiskScore !== null ? ` (score: ${input.overallRiskScore}/100)` : "";

  const summary =
    `Based on currently available on-chain evidence, this token presents ` +
    `${input.overallRiskLabel.toLowerCase()} protocol-level risk${scorePhrase}, ` +
    `with a confidence level of ${input.confidence}% based on the completeness ` +
    `of evaluable factors. This assessment reflects deterministic on-chain ` +
    `signals only and does not constitute financial advice.`;

  return {
    headline: levelPhrase,
    summary,
    key_findings: [...input.findings],
    limitations: [...input.caveats],
    provider: "deterministic_fallback",
    model: "none",
    generated_at: new Date().toISOString(),
  };
}

/**
 * Calls Groq with a strict system prompt and a timeout. Returns null
 * (never throws to the caller) on any failure - caller falls back to
 * the deterministic explanation.
 */
async function callGroq(input: DeterministicRiskSummary): Promise<GroqExplanation | null> {
  if (!GROQ_API_KEY) {
    console.log("[groq-explainer] No GROQ_API_KEY set - using deterministic fallback.");
    return null;
  }

  const systemPrompt = `You are a professional blockchain research analyst writing for OwlScope, a Solana token intelligence platform.

You will be given a DETERMINISTIC risk report (score, level, confidence, findings, limitations) that was already calculated by backend logic, not by you.

Your ONLY job is to restate and explain these exact facts in clear, professional research language. You are an explainer, not an analyst forming new conclusions.

STRICT RULES:
- Never change, recalculate, or contradict the provided score, level, or confidence.
- Never invent facts not present in the input: no liquidity, no volume, no total holder count, no wallet history, no developer behavior, no connected wallets, no rug-pull history.
- Never use trading/financial-advice language: no buy, sell, hold, entry, target price, "to the moon", multipliers like "10x", or guarantees.
- Never call any account a "whale" unless the input explicitly classifies it that way.
- Always clearly state limitations and unavailable data - do not gloss over them.
- Write like an intelligence report, not a chatbot. No exclamation points, no hype, no emoji.

Respond with ONLY a valid JSON object, no markdown, no code fences, matching exactly this shape:
{
  "headline": "string, one sentence",
  "summary": "string, 2-4 sentences",
  "key_findings": ["string", "..."],
  "limitations": ["string", "..."]
}`;

  const userPrompt = `Deterministic risk report:\n${JSON.stringify(
    {
      score: input.overallRiskScore,
      level: input.overallRiskLabel,
      confidence: input.confidence,
      findings: input.findings,
      known_limitations: input.caveats,
    },
    null,
    2
  )}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      // Never log the API key. errText/status only.
      console.error(`[groq-explainer] Groq HTTP ${response.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      console.error("[groq-explainer] Groq response missing message content.");
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[groq-explainer] Groq response was not valid JSON.");
      return null;
    }

    if (!validateGroqShape(parsed)) {
      console.error("[groq-explainer] Groq response failed schema validation.");
      return null;
    }

    const fullText = [parsed.headline, parsed.summary, ...parsed.key_findings, ...parsed.limitations].join(" \n ");
    const forbiddenHit = containsForbiddenLanguage(fullText);
    if (forbiddenHit) {
      console.error(`[groq-explainer] Groq response rejected - forbidden pattern matched: ${forbiddenHit}`);
      return null;
    }

    return {
      headline: parsed.headline,
      summary: parsed.summary,
      key_findings: parsed.key_findings,
      limitations: parsed.limitations,
      provider: "groq",
      model: GROQ_MODEL,
      generated_at: new Date().toISOString(),
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[groq-explainer] Groq request timed out after ${GROQ_TIMEOUT_MS}ms.`);
    } else {
      console.error(`[groq-explainer] Groq request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }
}

/**
 * Public entry point. Always resolves - never throws, never returns
 * null. Tries Groq first, falls back to a deterministic explanation
 * on any failure so the pipeline never breaks for lack of AI.
 */
export async function explainRiskReport(
  input: DeterministicRiskSummary
): Promise<GroqExplanation> {
  const groqResult = await callGroq(input);
  if (groqResult) {
    return groqResult;
  }
  return buildFallbackExplanation(input);
}