import { z } from "zod";

export const supportedCounts = [5, 10, 15, 20] as const;
export const languageSchema = z.enum(["English", "Indonesian"]);

export const flashcardSchema = z.object({
  question: z.string().trim().min(1).max(240),
  answer: z.string().trim().min(1).max(600),
}).strict();

export const flashcardsResponseSchema = z.object({
  cards: z.array(flashcardSchema).min(1).max(20),
}).strict();

export const generateRequestSchema = z.object({
  notes: z.string().trim().min(20, "Paste at least 20 characters of notes.").max(20000, "Notes must be 20,000 characters or fewer."),
  count: z.number().int().refine((value) => supportedCounts.some((n) => n === value), "Choose a supported card count."),
  language: languageSchema,
}).strict();

export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardsResponse = z.infer<typeof flashcardsResponseSchema>;
export type OutputLanguage = z.infer<typeof languageSchema>;
