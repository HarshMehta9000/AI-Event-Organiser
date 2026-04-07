import { GoogleGenerativeAI } from "@google/generative-ai";
import { CATEGORIES } from "@/lib/data";

/**
 * Gemini-powered event generator.
 *
 * Pulled out of the API route so the prompt, model config, and JSON
 * sanitisation logic can be unit-tested and reused (for example, from
 * a future CLI tool or a Convex action).
 */

const MODEL_NAME = "gemini-2.0-flash";
const MAX_RETRIES = 2;

let _client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _client;
}

const CATEGORY_IDS = CATEGORIES.map((c) => c.id).join(", ");

function buildPrompt(userIdea) {
  return `You are an event planning assistant. Generate event details based on the user's description.

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no code fences.
All string values must be on a single line — replace any line breaks with spaces.

Return this exact JSON shape:
{
  "title": "Catchy, professional event title (max 80 chars, single line)",
  "description": "2-3 sentence single-paragraph description of what attendees will learn and experience.",
  "category": "One of: ${CATEGORY_IDS}",
  "tags": ["3 to 5 short lowercase tags relevant to the event"],
  "suggestedCapacity": 50,
  "suggestedTicketType": "free",
  "suggestedDurationHours": 2
}

User's event idea: ${userIdea}

Rules:
- "category" MUST be exactly one of the listed ids.
- "tags" should be 3-5 short, lowercase, hyphen-free keywords (e.g. "react", "ai", "beginners").
- "suggestedTicketType" must be "free" or "paid".
- "suggestedCapacity" must be a positive integer.
- "suggestedDurationHours" must be a number between 1 and 12.`;
}

/**
 * Strip Markdown code fences that Gemini sometimes wraps JSON in,
 * even when explicitly told not to.
 */
function stripCodeFences(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  return cleaned.trim();
}

/**
 * Validate and normalise the parsed AI output so the client always
 * receives a predictable shape — even if the model improvises.
 */
function normaliseEventData(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("AI response was not an object");
  }

  const validCategoryIds = new Set(CATEGORIES.map((c) => c.id));
  const category = validCategoryIds.has(raw.category) ? raw.category : "community";

  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((t) => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.toLowerCase().trim())
        .slice(0, 5)
    : [];

  const capacity = Number.isFinite(raw.suggestedCapacity)
    ? Math.max(1, Math.floor(raw.suggestedCapacity))
    : 50;

  const ticketType = raw.suggestedTicketType === "paid" ? "paid" : "free";

  const durationHours = Number.isFinite(raw.suggestedDurationHours)
    ? Math.min(12, Math.max(1, raw.suggestedDurationHours))
    : 2;

  return {
    title: String(raw.title || "").slice(0, 120),
    description: String(raw.description || ""),
    category,
    tags,
    suggestedCapacity: capacity,
    suggestedTicketType: ticketType,
    suggestedDurationHours: durationHours,
  };
}

/**
 * Public entry point. Calls Gemini with light retry on parse failures
 * (the model occasionally returns malformed JSON on the first try).
 */
export async function generateEventFromPrompt(userPrompt) {
  if (!userPrompt || !userPrompt.trim()) {
    throw new Error("Prompt is required");
  }

  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL_NAME });
  const prompt = buildPrompt(userPrompt);

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleaned = stripCodeFences(text);
      const parsed = JSON.parse(cleaned);
      return normaliseEventData(parsed);
    } catch (err) {
      lastError = err;
      // Only retry on JSON parse errors — auth/quota errors won't fix themselves.
      if (!(err instanceof SyntaxError)) break;
    }
  }

  throw new Error(`AI generation failed: ${lastError?.message || "unknown error"}`);
}
