import { NextResponse } from "next/server";
import { generateRequestSchema } from "@/lib/schema";
import { FlashcardGenerationError, generateFlashcards } from "@/lib/flashcard-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please send a valid JSON request.", code: "BAD_REQUEST" }, { status: 400 });
  }

  const input = generateRequestSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({
      error: input.error.issues[0]?.message ?? "Please check your notes and settings.",
      code: "VALIDATION_ERROR",
    }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      error: "AI generation is not configured yet. Add GEMINI_API_KEY to your local environment.",
      code: "MISSING_API_KEY",
    }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 27_000);

  try {
    const cards = await generateFlashcards({ ...input.data, signal: controller.signal });
    return NextResponse.json({ cards });
  } catch (error) {
    if (error instanceof FlashcardGenerationError) {
      if (error.code === "TIMEOUT") {
        return NextResponse.json({ error: "The request took too long. Try generating the cards again.", code: "TIMEOUT" }, { status: 504 });
      }
      if (error.code === "INVALID_OUTPUT") {
        return NextResponse.json({ error: "The AI returned flashcards in an unexpected format. Please try again.", code: "INVALID_OUTPUT" }, { status: 502 });
      }
      if (error.code === "INVALID_API_KEY") {
        return NextResponse.json({ error: "Google Gemini rejected the API key or project access. Check your key and API access in Google AI Studio.", code: "INVALID_API_KEY" }, { status: 502 });
      }
      if (error.code === "INVALID_MODEL") {
        return NextResponse.json({ error: "The configured Gemini model was not found or is unavailable. Check GEMINI_MODEL in your environment.", code: "INVALID_MODEL" }, { status: 502 });
      }
      if (error.code === "RATE_LIMITED") {
        return NextResponse.json({ error: "Gemini's free-tier quota or rate limit may have been reached. Check your usage limits in Google AI Studio and try again later.", code: "RATE_LIMITED" }, { status: 429 });
      }
      return NextResponse.json({ error: "Gemini could not complete the request. Check the API status and settings, then try again.", code: "UPSTREAM_ERROR" }, { status: 502 });
    }

    console.error("Flashcard generation failed.", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Something went wrong while generating cards. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
