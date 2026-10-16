# AI Flashcard Maker

A Next.js application that turns pasted study notes into structured, interactive flashcards using the Google Gemini API.

## Features

- Paste notes and generate 5, 10, 15, or 20 question-and-answer cards.
- Choose English or Bahasa Indonesia for the output.
- Request schema-guided JSON output from Gemini, then validate the result with Zod on the server.
- Flip cards, navigate with buttons or keyboard shortcuts, shuffle, and mark cards as known or needing review.
- Track session progress.
- Copy or download the deck as JSON.
- Restore the latest deck from browser `localStorage`.
- Server-side API key handling and safe error responses.
- Responsive layout for desktop and mobile.

## Requirements

- Node.js 20.9 or newer (use a current supported Node.js LTS release).
- npm.
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Free-tier note

Google lists a free tier for selected Gemini API models, including `gemini-3.8-flash` at the time this project was updated. The free tier has usage and rate limits that can change. Google also states that content sent through the free tier may be used to improve its products. Avoid pasting passwords, private, confidential, or sensitive information into the app. Review the current [Gemini API pricing and free-tier details](https://ai.google.dev/gemini-api/docs/pricing) before using it. Free use is not unlimited, and availability can depend on account, region, model access, and current policy.

## Run locally

1. Extract the ZIP and enter the project folder:

   ```bash
   cd ai-flashcard-maker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local` by copying the example file:

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env.local
   ```

   **macOS / Linux**

   ```bash
   cp .env.example .env.local
   ```

4. Open `.env.local` and set your Google AI Studio key:

   ```env
   GEMINI_API_KEY=your_actual_api_key
   GEMINI_MODEL=gemini-3.8-flash
   ```

   Keep the key secret. Do not put it in a client component, a `NEXT_PUBLIC_...` variable, or commit `.env.local` to Git.

5. Start the dev server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Verify and build

```bash
npm run typecheck
npm run build
npm run start
```

The project cannot generate real cards until a valid `GEMINI_API_KEY` and accessible model are configured. A quota or rate-limit error may mean that the project's free-tier limit has been reached; review usage and quotas in Google AI Studio.

## Deploy

Deploy the project to a Next.js-compatible host such as Vercel. Add `GEMINI_API_KEY` and (optionally) `GEMINI_MODEL` to the server-side environment variables, redeploy, and test a real generation. Never expose the key through a public environment variable.

## Notes on data and privacy

- The application sends pasted notes to Google Gemini for generation when the user presses Generate.
- Per Google's current free-tier pricing information, free-tier content may be used to improve Google's products. Review the linked terms before sending content.
- The latest deck and notes are stored in the current browser's `localStorage` so the deck can be restored on that browser.
- Clearing a deck removes the local saved copy. It does not erase data already sent to the AI provider.
- This MVP has no authentication, cloud database, or cross-device sync.
