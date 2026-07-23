"use client";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  analyzeSentiment,
  AnalyzeSentimentError,
} from "@/lib/analyze-sentiment";
import type { JSONContent } from "@tiptap/react";
import { useCallback, useMemo, useState } from "react";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function formatJournalDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function sentimentLabel(score: number): string {
  if (score >= 0.35) return "Positive";
  if (score <= -0.35) return "Low";
  return "Balanced";
}

function moodBackgroundClass(score: number | null): string {
  if (score === null) return "";
  if (score >= 0.35) return "journal-page--bright";
  if (score <= -0.35) return "journal-page--dark";
  return "";
}

export default function JournalPage() {
  const [editorGeneration, setEditorGeneration] = useState(0);
  const [sentimentScore, setSentimentScore] = useState<number | null>(null);
  const [analyzedSnippet, setAnalyzedSnippet] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const todayLabel = useMemo(() => formatJournalDate(new Date()), []);

  const pageMoodClass = useMemo(
    () => moodBackgroundClass(sentimentScore),
    [sentimentScore],
  );

  const handleSubmitEntry = useCallback(async (text: string) => {
    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const { sentimentScore: score } = await analyzeSentiment(text);
      setSentimentScore(score);
      setAnalyzedSnippet(text);
      setEditorGeneration((n) => n + 1);
    } catch (error) {
      setSentimentScore(null);
      setAnalyzedSnippet(null);
      setAnalyzeError(
        error instanceof AnalyzeSentimentError
          ? error.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return (
    <div
      className={`journal-page flex min-h-full flex-1 flex-col ${pageMoodClass}`.trim()}
    >
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="space-y-1 text-center sm:text-left">
          <p className="text-sm font-medium tracking-wide text-journal-muted uppercase">
            Today
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-journal-text sm:text-3xl">
            {todayLabel}
          </h1>
        </header>

        <section
          aria-label="Journal entry"
          className="journal-editor-shell flex min-h-[min(50vh,420px)] flex-1 flex-col overflow-hidden rounded-3xl border border-journal-border bg-journal-surface shadow-[0_8px_32px_-8px_rgba(47,89,67,0.12)]"
        >
          <RichTextEditor
            key={editorGeneration}
            defaultContent={EMPTY_DOC}
            onSubmitEnter={handleSubmitEntry}
            placeholder="What's on your mind today?"
            className="flex min-h-0 flex-1 flex-col"
            editorClassName="min-h-[min(50vh,420px)] px-6 py-5 sm:px-8 sm:py-6"
            editable={!isAnalyzing}
          />
        </section>

        <p className="text-center text-sm text-journal-muted sm:text-left">
          {isAnalyzing
            ? "Reading your words…"
            : "Press Enter to analyze · Shift+Enter for a new line"}
        </p>

        <section
          aria-live="polite"
          aria-label="Sentiment result"
          className="rounded-3xl border border-journal-border bg-journal-surface/90 p-6 shadow-[0_8px_24px_-10px_rgba(47,89,67,0.1)]"
        >
          <h2 className="text-sm font-medium tracking-wide text-journal-muted uppercase">
            Mood snapshot
          </h2>

          {analyzeError ? (
            <p className="mt-3 text-sm text-red-700/90">{analyzeError}</p>
          ) : null}

          {!analyzeError && sentimentScore === null && !isAnalyzing ? (
            <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-journal-accent/60 bg-journal-bg/40 text-sm text-journal-muted">
              Graphics will appear here after you press Enter.
            </div>
          ) : null}

          {isAnalyzing ? (
            <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-2xl bg-journal-bg/50 text-sm text-journal-muted">
              Analyzing…
            </div>
          ) : null}

          {!isAnalyzing && sentimentScore !== null ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <p className="text-4xl font-semibold tabular-nums text-journal-text">
                  {sentimentScore.toFixed(2)}
                </p>
                <p className="pb-1 text-lg font-medium text-journal-muted">
                  {sentimentLabel(sentimentScore)}
                </p>
              </div>

              <div
                className="flex min-h-[120px] items-center justify-center rounded-2xl border border-journal-border bg-linear-to-br from-journal-bg via-journal-surface to-journal-accent/30"
                aria-hidden
              >
                <span className="text-sm text-journal-muted">
                  Visual mood graphic — coming next
                </span>
              </div>

              {analyzedSnippet ? (
                <p className="text-sm text-journal-muted">
                  From: “
                  {analyzedSnippet.length > 120
                    ? `${analyzedSnippet.slice(0, 120)}…`
                    : analyzedSnippet}
                  ”
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
