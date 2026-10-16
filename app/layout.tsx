import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Flashcard Maker — Learn what matters",
  description: "Turn your study notes into thoughtful, interactive flashcards with AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
