"use client";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { getMoodResponse, MoodResponseError } from "@/lib/get-mood-response";
import { createClient } from "@/lib/supabase/client";
import type { JSONContent } from "@tiptap/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const LIVE_MOOD_PREFERENCE_KEY = "journal-live-mood-tracking";
const MOOD_ANALYSIS_DELAY_MS = 450;

function formatJournalDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type MoodReaction = "happy" | "sad" | null;

export default function JournalPage() {
  const [liveMoodTracking, setLiveMoodTracking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [moodLevel, setMoodLevel] = useState(0);
  const [editorText, setEditorText] = useState("");

  const todayLabel = useMemo(() => formatJournalDate(new Date()), []);
  const moodReaction: MoodReaction =
    moodLevel > 0 ? "happy" : moodLevel < 0 ? "sad" : null;
  const moodStrength = Math.abs(moodLevel) / 5;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setLiveMoodTracking(
          window.localStorage.getItem(LIVE_MOOD_PREFERENCE_KEY) === "true",
        );
      } catch {
        // The preference simply remains off when storage is unavailable.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!liveMoodTracking) return;

    const text = editorText.trim();
    if (!text) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsAnalyzing(true);
      setAnalyzeError(null);

      try {
        const { moodScore } = await getMoodResponse(text, controller.signal);
        const scaledLevel =
          moodScore === 0
            ? 0
            : Math.sign(moodScore) *
              Math.max(1, Math.round(Math.abs(moodScore) * 5));
        setMoodLevel(Math.max(-5, Math.min(5, scaledLevel)));
      } catch (error) {
        if (controller.signal.aborted) return;
        setAnalyzeError(
          error instanceof MoodResponseError
            ? error.message
            : "Something went wrong. Try again.",
        );
      } finally {
        if (!controller.signal.aborted) setIsAnalyzing(false);
      }
    }, MOOD_ANALYSIS_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [editorText, liveMoodTracking]);

  const handleEditorTextChange = useCallback((text: string) => {
    setEditorText(text);
    if (!text.trim()) setMoodLevel(0);
  }, []);

  const handleTrackingToggle = useCallback(() => {
    const nextValue = !liveMoodTracking;
    setIsAnalyzing(false);
    setAnalyzeError(null);
    if (!nextValue) setMoodLevel(0);
    setLiveMoodTracking(nextValue);

    try {
      window.localStorage.setItem(LIVE_MOOD_PREFERENCE_KEY, String(nextValue));
    } catch {
      // Live tracking still works for this session without persistence.
    }
  }, [liveMoodTracking]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setLogoutError(error.message);
        return;
      }

      window.location.assign("/");
    } catch {
      setLogoutError("We could not log you out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  return (
    <div
      className={`journal-page flex min-h-full flex-1 flex-col${
        moodReaction ? ` journal-page--${moodReaction}` : ""
      }`}
      style={{ "--mood-strength": moodStrength } as CSSProperties}
    >
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-sm font-medium tracking-wide text-journal-muted uppercase">
              Today
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-journal-text sm:text-3xl">
              {todayLabel}
            </h1>
          </div>

          <div className="flex items-center justify-center gap-5 text-sm font-medium text-journal-text">
            <div className="flex items-center gap-3">
              <span>Live mood</span>
              <button
                type="button"
                role="switch"
                aria-checked={liveMoodTracking}
                onClick={handleTrackingToggle}
                className={`relative h-7 w-12 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text ${
                  liveMoodTracking
                    ? "border-journal-text bg-journal-text"
                    : "border-journal-muted/50 bg-journal-surface/80"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full shadow-sm transition-all ${
                    liveMoodTracking
                      ? "left-6 bg-journal-surface"
                      : "left-1 bg-journal-muted"
                  }`}
                />
                <span className="sr-only">
                  {liveMoodTracking
                    ? "Disable live mood tracking"
                    : "Enable live mood tracking"}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="rounded-full border border-journal-border bg-journal-surface/80 px-4 py-2 text-sm font-semibold transition hover:border-journal-muted hover:bg-journal-surface disabled:cursor-wait disabled:opacity-60"
            >
              {isLoggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        </header>

        <section
          aria-label="Journal entry"
          className="journal-editor-shell flex min-h-[min(50vh,420px)] flex-1 flex-col overflow-hidden rounded-3xl border border-journal-border bg-journal-surface shadow-[0_8px_32px_-8px_rgba(47,89,67,0.12)]"
        >
          <RichTextEditor
            defaultContent={EMPTY_DOC}
            onTextChange={handleEditorTextChange}
            placeholder="What's on your mind today?"
            className="flex min-h-0 flex-1 flex-col"
            editorClassName="min-h-[min(50vh,420px)] px-6 py-5 sm:px-8 sm:py-6"
          />
        </section>

        <button
          type="button"
          className="self-end rounded-full bg-journal-text px-6 py-3 text-sm font-semibold text-journal-surface shadow-[0_6px_16px_-6px_rgba(47,89,67,0.5)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(47,89,67,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text"
        >
          Save to journal
        </button>

        <p className="sr-only" aria-live="polite">
          {logoutError
            ? logoutError
            : analyzeError
              ? analyzeError
            : isAnalyzing
              ? "Reading the mood of your journal entry."
              : ""}
        </p>
      </main>
    </div>
  );
}
