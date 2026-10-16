"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clipboard, FileText, Layers3, LoaderCircle,
  RotateCcw, Shuffle, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import type { Flashcard, OutputLanguage } from "@/lib/schema";

const EXAMPLE_EN = `Artificial intelligence (AI) is a field of computer science focused on creating systems that can perform tasks associated with human intelligence. Machine learning (ML) is a subset of AI that enables systems to learn patterns from data rather than following only explicit rules. Supervised learning trains a model on labeled examples. Unsupervised learning looks for patterns in unlabeled data. Generative AI creates new content such as text, images, audio, or code. A large language model (LLM) is trained on large amounts of text to process and generate language. A prompt is the instruction or context provided to an AI model. Structured output means asking a model to return data in a specific format, such as JSON, so software can reliably parse it. Validation checks whether generated data follows the expected schema. A hallucination occurs when an AI system produces information that is incorrect or unsupported.`;
const EXAMPLE_ID = `Kecerdasan buatan (AI) adalah bidang ilmu komputer yang berfokus pada pembuatan sistem untuk melakukan tugas yang biasanya membutuhkan kecerdasan manusia. Machine learning (ML) adalah bagian dari AI yang membuat sistem mempelajari pola dari data, bukan hanya mengikuti aturan eksplisit. Supervised learning melatih model menggunakan contoh yang memiliki label. Unsupervised learning mencari pola dalam data tanpa label. AI generatif membuat konten baru seperti teks, gambar, audio, atau kode. Large language model (LLM) dilatih dengan banyak teks untuk memahami dan menghasilkan bahasa. Prompt adalah instruksi atau konteks yang diberikan kepada model AI. Structured output berarti meminta model menghasilkan data dalam format tertentu, seperti JSON, agar dapat dibaca dengan andal oleh perangkat lunak. Validasi memeriksa apakah data sesuai dengan skema yang diharapkan. Halusinasi terjadi ketika sistem AI menghasilkan informasi yang keliru atau tidak didukung sumber.`;

type ProgressValue = "known" | "review";
type StoredDeck = { notes: string; cards: Flashcard[]; language: OutputLanguage; count: number; progress: Record<string, ProgressValue> };
const STORAGE_KEY = "ai-flashcard-maker-deck-v1";

export default function FlashcardMaker() {
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);
  const [language, setLanguage] = useState<OutputLanguage>("English");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState<Record<string, ProgressValue>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const deck = JSON.parse(saved) as StoredDeck;
        if (Array.isArray(deck.cards) && typeof deck.notes === "string") {
          setNotes(deck.notes);
          setCards(deck.cards);
          setLanguage(deck.language === "Indonesian" ? "Indonesian" : "English");
          setCount([5, 10, 15, 20].includes(deck.count) ? deck.count : 10);
          setProgress(deck.progress && typeof deck.progress === "object" ? deck.progress : {});
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (cards.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const deck: StoredDeck = { notes, cards, language, count, progress };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
  }, [hydrated, notes, cards, language, count, progress]);

  const currentCard = cards[current];
  const knownCount = useMemo(() => cards.filter((card) => progress[card.question] === "known").length, [cards, progress]);
  const reviewCount = useMemo(() => cards.filter((card) => progress[card.question] === "review").length, [cards, progress]);
  const completion = cards.length ? Math.round((knownCount / cards.length) * 100) : 0;

  const generate = useCallback(async () => {
    setError("");
    setNotice("");
    if (notes.trim().length < 20) {
      setError("Tambahkan catatan minimal 20 karakter sebelum membuat flashcard.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim(), count, language }),
      });
      const data = await response.json() as { cards?: Flashcard[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal membuat flashcard. Coba lagi.");
      if (!Array.isArray(data.cards) || data.cards.length === 0) throw new Error("AI belum menghasilkan kartu yang valid. Coba sekali lagi.");
      setCards(data.cards);
      setCurrent(0);
      setFlipped(false);
      setProgress({});
      setNotice(`${data.cards.length} flashcard berhasil dibuat.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [notes, count, language]);

  const goTo = (index: number) => {
    if (!cards.length) return;
    setCurrent((index + cards.length) % cards.length);
    setFlipped(false);
  };

  const markCard = (value: ProgressValue) => {
    if (!currentCard) return;
    setProgress((previous) => ({ ...previous, [currentCard.question]: value }));
    if (current < cards.length - 1) goTo(current + 1);
    else setNotice(value === "known" ? "Bagus! Kartu terakhir ditandai sudah dikuasai." : "Kartu terakhir ditandai untuk diulang.");
  };

  const shuffleCards = () => {
    const next = [...cards];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setCards(next);
    setCurrent(0);
    setFlipped(false);
    setNotice("Urutan flashcard diacak.");
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ cards }, null, 2));
      setNotice("JSON berhasil disalin ke clipboard.");
    } catch {
      setError("Clipboard tidak tersedia. Coba unduh file JSON.");
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify({ cards }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "flashcards.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("File JSON sedang diunduh.");
  };

  const clearDeck = () => {
    if (!window.confirm("Hapus deck dan catatan yang tersimpan di browser ini?")) return;
    setNotes("");
    setCards([]);
    setProgress({});
    setCurrent(0);
    setFlipped(false);
    setError("");
    setNotice("Deck berhasil dihapus.");
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (!cards.length || typing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === "Space") { event.preventDefault(); setFlipped((value) => !value); }
      if (event.key === "ArrowRight") { event.preventDefault(); goTo(current + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); goTo(current - 1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cards.length, current]);

  const setExample = () => {
    setNotes(language === "Indonesian" ? EXAMPLE_ID : EXAMPLE_EN);
    setError("");
    setNotice("Contoh catatan dimasukkan. Klik Generate untuk membuat kartu.");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AI Flashcard Maker home">
          <span className="brand-mark"><Layers3 size={20} strokeWidth={2.3} /></span>
          <span>flash<span className="brand-accent">wise</span></span>
        </a>
        <div className="topbar-right"><span className="ai-pill"><Sparkles size={13} /> AI-POWERED LEARNING</span><span className="avatar">F</span></div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="eyebrow-dot" /> YOUR NOTES, MADE MEMORABLE</div>
        <h1>Learn smarter.<br /><span>One card at a time.</span></h1>
        <p className="hero-copy">Turn your notes into bite-sized flashcards with AI. Spend less time making study materials, and more time actually learning.</p>
        <div className="hero-proof"><span><CheckCircle2 size={15} /> Based on your notes</span><span><CheckCircle2 size={15} /> Made for active recall</span><span><CheckCircle2 size={15} /> Yours to keep</span></div>
      </section>

      {(error || notice) && <div className={`toast ${error ? "toast-error" : "toast-success"}`} role="status">{error ? <CircleHelp size={17} /> : <CheckCircle2 size={17} />}{error || notice}<button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}><X size={16} /></button></div>}

      <section className={`workspace ${cards.length ? "workspace-with-deck" : ""}`}>
        <aside className="input-panel panel">
          <div className="panel-heading"><div><div className="section-kicker">STEP 01</div><h2>Drop in your notes</h2><p>Paste a lesson, article, or your own study notes.</p></div><div className="heading-icon"><FileText size={20} /></div></div>
          <label className="sr-only" htmlFor="notes">Your study notes</label>
          <div className="textarea-wrap">
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20000} placeholder="Paste your notes here...\n\nThe more focused your notes, the better your flashcards will be." />
            <div className="textarea-footer"><span><FileText size={13} /> {notes.trim() ? notes.trim().split(/\s+/).length : 0} words</span><span>{notes.length.toLocaleString()}/20,000</span></div>
          </div>
          <button className="example-link" onClick={setExample}><Sparkles size={15} /> Try example notes <ArrowRight size={14} /></button>
          <div className="panel-divider" />
          <div className="section-kicker">STEP 02</div>
          <h2 className="settings-title">Make it yours</h2>
          <div className="settings-grid">
            <div className="field"><label htmlFor="card-count">Number of cards</label><div className="select-wrap"><Layers3 size={16} /><select id="card-count" value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={5}>5 cards</option><option value={10}>10 cards</option><option value={15}>15 cards</option><option value={20}>20 cards</option></select><ChevronDown size={15} /></div></div>
            <div className="field"><label htmlFor="language">Card language</label><div className="select-wrap"><Upload size={15} className="language-icon" /><select id="language" value={language} onChange={(e) => setLanguage(e.target.value as OutputLanguage)}><option value="English">English</option><option value="Indonesian">Bahasa Indonesia</option></select><ChevronDown size={15} /></div></div>
          </div>
          <button className="generate-button" onClick={generate} disabled={loading || notes.trim().length < 20}>
            {loading ? <><LoaderCircle className="spin" size={18} /> Making your flashcards...</> : <><Sparkles size={17} /> Generate flashcards <ArrowRight size={17} /></>}
          </button>
          <p className="privacy-note"><span className="privacy-dot" /> Your notes stay in this session and local browser storage.</p>
        </aside>

        <section className="study-panel panel">
          {cards.length === 0 ? <div className="empty-study">
            <div className="empty-illustration"><div className="float-card float-card-back"><span className="tiny-line" /><span className="tiny-line short" /><span className="tiny-dot" /></div><div className="float-card float-card-front"><span className="mini-badge">Q</span><span className="illustration-line" /><span className="illustration-line medium" /><span className="illustration-line short" /><span className="flip-hint"><RotateCcw size={13} /> FLIP TO REVEAL</span></div><span className="sparkle sparkle-one">✳</span><span className="sparkle sparkle-two">✦</span></div>
            <div className="empty-copy"><div className="section-kicker">YOUR STUDY SPACE</div><h2>Your next “aha!”<br />moment starts here.</h2><p>Your flashcards will show up here after you generate them. Then flip, review, and see what sticks.</p></div>
            <div className="empty-steps"><div><span>1</span><p>Paste your notes</p></div><ArrowRight size={14} /><div><span>2</span><p>Generate cards</p></div><ArrowRight size={14} /><div><span>3</span><p>Start learning</p></div></div>
          </div> : <div className="study-content">
            <div className="study-header"><div><div className="section-kicker">YOUR STUDY SESSION</div><h2>Let’s make it stick.</h2><p>Think of your answer, then flip the card.</p></div><div className="deck-count"><BookOpen size={16} /><strong>{cards.length}</strong><span>cards</span></div></div>
            <div className="study-toolbar"><span className="card-position">CARD <strong>{String(current + 1).padStart(2, "0")}</strong> <span className="position-divider">/</span> {String(cards.length).padStart(2, "0")}</span><button className="tool-button" onClick={shuffleCards}><Shuffle size={14} /> Shuffle</button></div>
            <button className={`flashcard ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Show question" : "Reveal answer"}>
              <span className="card-topline"><span className={`question-tag ${flipped ? "answer-tag" : ""}`}>{flipped ? "THE ANSWER" : "QUESTION"}</span><span className="card-id">#{String(current + 1).padStart(2, "0")}</span></span>
              <span className="card-main-text">{currentCard?.[flipped ? "answer" : "question"]}</span>
              <span className="card-bottomline"><span className="flip-instruction"><RotateCcw size={14} /> {flipped ? "Back to question" : "Click to reveal answer"}</span><span className="card-decoration">✳</span></span>
            </button>
            <div className="keyboard-hint"><kbd>SPACE</kbd> to flip <span>·</span> <kbd>←</kbd> <kbd>→</kbd> to navigate</div>
            <div className="card-navigation"><button className="nav-button" onClick={() => goTo(current - 1)} aria-label="Previous card"><ArrowLeft size={17} /></button><div className="progress-track" aria-label={`Card ${current + 1} of ${cards.length}`}><div className="progress-fill" style={{ width: `${((current + 1) / cards.length) * 100}%` }} /></div><button className="nav-button nav-next" onClick={() => goTo(current + 1)} aria-label="Next card"><ArrowRight size={17} /></button></div>
            <div className="review-actions"><button className="review-button review-again" onClick={() => markCard("review")}><RotateCcw size={15} /> Review again</button><button className="review-button know-button" onClick={() => markCard("known")}><Check size={16} /> Know it</button></div>
            <div className="study-stats"><div><span className="stat-dot stat-known" /><strong>{knownCount}</strong><span>Known</span></div><div><span className="stat-dot stat-review" /><strong>{reviewCount}</strong><span>Review</span></div><div className="stats-progress"><strong>{completion}%</strong><span>Mastered</span></div></div>
            {knownCount === cards.length && <div className="completion-message"><CheckCircle2 size={17} /><span><strong>Deck complete!</strong> You marked every card as known.</span></div>}
          </div>}
        </section>
      </section>

      <section className="bottom-bar"><div className="bottom-label"><Sparkles size={15} /><span>SMALL SESSIONS. BIG PROGRESS.</span></div><div className="bottom-actions">{cards.length > 0 && <><button onClick={copyJson}><Clipboard size={14} /> Copy JSON</button><button onClick={downloadJson}><ArrowDownToLine size={14} /> Export deck</button><button className="clear-button" onClick={clearDeck}><Trash2 size={14} /> Clear</button></>}</div></section>
      <footer className="footer"><span>Built for curious minds.</span><span>AI-generated cards may need a quick fact-check.</span></footer>
    </main>
  );
}
