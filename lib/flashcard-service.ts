import { flashcardsResponseSchema, type Flashcard, type OutputLanguage } from "@/lib/schema";

const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const responseSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "One concise question testing one concept.",
          },
          answer: {
            type: "string",
            description: "A concise answer supported by the user's notes.",
          },
        },
        required: ["question", "answer"],
        propertyOrdering: ["question", "answer"],
      },
    },
  },
  required: ["cards"],
  propertyOrdering: ["cards"],
};

type GeminiErrorCode =
  | "INVALID_OUTPUT"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "INVALID_MODEL";

export class FlashcardGenerationError extends Error {
  constructor(public code: GeminiErrorCode) {
    super(code);
    this.name = "FlashcardGenerationError";
  }
}

function normalizeCards(cards: Flashcard[]): Flashcard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.question.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readGeminiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message.slice(0, 500) : "";
}

function mapGeminiError(status: number, message: string): GeminiErrorCode {
  const lower = message.toLowerCase();
  if (
    status === 401 || status === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("invalid api key") ||
    lower.includes("api_key_invalid") ||
    lower.includes("reported as leaked")
  ) return "INVALID_API_KEY";
  if (status === 404 || (lower.includes("model") && (lower.includes("not found") || lower.includes("does not exist") || lower.includes("not supported")))) {
    return "INVALID_MODEL";
  }
  if (status === 429 || lower.includes("quota") || lower.includes("rate limit") || lower.includes("resource_exhausted")) {
    return "RATE_LIMITED";
  }
  return "UPSTREAM_ERROR";
}

function errorPayloadMessage(payload: unknown): string {
  return readGeminiErrorMessage(payload) || "Gemini returned an error without a message.";
}

export async function generateFlashcards(args: {
  notes: string;
  count: number;
  language: OutputLanguage;
  signal: AbortSignal;
}): Promise<Flashcard[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("MISSING_API_KEY");

  const languageInstruction = args.language === "Indonesian"
    ? "Write every question and answer in natural Indonesian (Bahasa Indonesia)."
    : "Write every question and answer in English.";
  let lastIssue = "The response did not match the required schema.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryInstruction = attempt === 0
      ? ""
      : `\nYour previous attempt failed validation: ${lastIssue}. Fix the issue and return exactly ${args.count} valid, unique cards.`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: args.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: [
                "You are a careful study-material designer.",
                "Create useful retrieval-practice flashcards from the notes supplied by the user.",
                "Use only facts supported by the notes; do not invent details.",
                "Avoid duplicates, trivia, and vague questions. Each card should test one idea.",
                "Keep answers concise but complete.",
                "Return only JSON matching the provided response schema.",
              ].join(" "),
            }],
          },
          contents: [{
            role: "user",
            parts: [{
              text: `Create exactly ${args.count} distinct flashcards from these notes. ${languageInstruction}${retryInstruction}\n\nNOTES START\n${args.notes}\nNOTES END`,
            }],
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3500,
            responseFormat: {
              text: {
                mimeType: "APPLICATION_JSON",
                schema: responseSchema,
              },
            },
          },
        }),
      });
    } catch (error) {
      if (args.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new FlashcardGenerationError("TIMEOUT");
      }
      throw error;
    }

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // Some upstream failures may not include a JSON body.
      }
      const message = errorPayloadMessage(payload);
      const code = mapGeminiError(response.status, message);
      // Log only upstream metadata. Never log API keys or the user's notes.
      console.error("[flashcards] Gemini API request failed", {
        status: response.status,
        code,
        message,
      });
      throw new FlashcardGenerationError(code);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      lastIssue = "Gemini returned an unreadable response.";
      continue;
    }

    const candidates = payload && typeof payload === "object"
      ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates
      : undefined;
    const text = candidates?.[0]?.content?.parts
      ?.map((part) => typeof part.text === "string" ? part.text : "")
      .join("")
      .trim();

    if (!text) {
      lastIssue = "Gemini did not return JSON text. The response may have been blocked or truncated.";
      continue;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(text);
    } catch {
      lastIssue = "Gemini returned malformed JSON.";
      continue;
    }

    const parsed = flashcardsResponseSchema.safeParse(decoded);
    if (!parsed.success) {
      lastIssue = "Gemini returned missing or invalid question/answer fields.";
      continue;
    }

    const uniqueCards = normalizeCards(parsed.data.cards);
    if (uniqueCards.length !== args.count) {
      lastIssue = `Expected ${args.count} unique cards but received ${uniqueCards.length}.`;
      continue;
    }

    return uniqueCards;
  }

  throw new FlashcardGenerationError("INVALID_OUTPUT");
}
