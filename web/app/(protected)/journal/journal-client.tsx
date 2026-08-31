"use client";

import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TeddyReaction } from "@/components/journal/teddy-reaction";
import { ApiRequestError } from "@/lib/api/client";
import { getMoodResponse } from "@/lib/get-mood-response";
import {
  addJournalEntry,
  getJournalEntries,
  type JournalEntry,
} from "@/lib/journal-api";
import { createClient } from "@/lib/supabase/client";
import {
  getTeddyReaction,
  type TeddyReaction as TeddyReactionType,
} from "@/lib/teddy-reaction";
import type { JSONContent } from "@tiptap/react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const LIVE_MOOD_PREFERENCE_KEY = "journal-live-mood-tracking";
const MOOD_ANALYSIS_DELAY_MS = 450;
const TEDDY_REACTION_DURATION_MS = 5000;

function formatJournalDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatJournalTooltipDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type MoodReaction = "happy" | "sad" | null;

export function JournalClient() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveMoodTracking, setLiveMoodTracking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [moodLevel, setMoodLevel] = useState(0);
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [teddyReaction, setTeddyReaction] =
    useState<TeddyReactionType | null>(null);
  const [editorText, setEditorText] = useState("");
  const [editorContent, setEditorContent] = useState<JSONContent>(EMPTY_DOC);
  const [editorKey, setEditorKey] = useState(0);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  const todayLabel = useMemo(() => formatJournalDate(new Date()), []);
  const displayedDateLabel = selectedEntry
    ? formatJournalDate(new Date(selectedEntry.createdAt))
    : todayLabel;
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
    let active = true;

    async function loadEntries() {
      try {
        const savedEntries = await getJournalEntries();
        if (active) setEntries(savedEntries);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[journal] Failed to load entries", error);
        }
      } finally {
        if (active) setIsLoadingEntries(false);
      }
    }

    void loadEntries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!liveMoodTracking || selectedEntry) return;

    const text = editorText.trim();
    if (!text) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsAnalyzing(true);
      setAnalyzeError(null);

      try {
        const { moodScore } = await getMoodResponse(text, controller.signal);
        setMoodScore(moodScore);
        const scaledLevel =
          moodScore === 0
            ? 0
            : Math.sign(moodScore) *
              Math.max(1, Math.round(Math.abs(moodScore) * 5));
        setMoodLevel(Math.max(-5, Math.min(5, scaledLevel)));
      } catch (error) {
        if (controller.signal.aborted) return;
        setAnalyzeError(
          error instanceof ApiRequestError
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
  }, [editorText, liveMoodTracking, selectedEntry]);

  useEffect(() => {
    if (!saveMessage) return;

    const timer = window.setTimeout(() => setSaveMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  useEffect(() => {
    if (!teddyReaction) return;

    const timer = window.setTimeout(
      () => setTeddyReaction(null),
      TEDDY_REACTION_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [teddyReaction]);

  const handleEditorTextChange = useCallback((text: string) => {
    setEditorText(text);
    if (!text.trim()) {
      setMoodLevel(0);
      setMoodScore(null);
    }
  }, []);

  const handleEditorContentChange = useCallback((content: JSONContent) => {
    setEditorContent(content);
  }, []);

  const handleTrackingToggle = useCallback(() => {
    const nextValue = !liveMoodTracking;
    setIsAnalyzing(false);
    setAnalyzeError(null);
    if (!nextValue) {
      setMoodLevel(0);
      setMoodScore(null);
    }
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

  const handleSave = useCallback(async () => {
    const plainText = editorText.trim();
    setJournalError(null);
    setSaveMessage("");
    setTeddyReaction(null);

    if (!plainText) {
      setJournalError("Write something before saving your journal entry.");
      return;
    }

    setIsSaving(true);
    try {
      const savedEntry = await addJournalEntry({
        content: editorContent,
        plainText,
        moodScore,
      });
      setEntries((current) => [savedEntry, ...current]);
      setEditorText("");
      setEditorContent(EMPTY_DOC);
      setEditorKey((current) => current + 1);
      setMoodLevel(0);
      setMoodScore(null);
      setTeddyReaction(getTeddyReaction(savedEntry.sentimentLabel));
      setSaveMessage("Journal entry saved");
    } catch (error) {
      setJournalError(
        error instanceof ApiRequestError
          ? error.message
          : "We could not save your journal entry.",
      );
    } finally {
      setIsSaving(false);
    }
  }, [editorContent, editorText, moodScore]);

  const handleSelectEntry = useCallback((entry: JournalEntry) => {
    setSelectedEntry(entry);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsSidebarOpen(false);
    }
    setJournalError(null);
    setSaveMessage("");
    setTeddyReaction(null);
  }, []);

  const handleNewEntry = useCallback(() => {
    setSelectedEntry(null);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsSidebarOpen(false);
    }
    setJournalError(null);
    setSaveMessage("");
    setTeddyReaction(null);
  }, []);

  return (
    <div
      className={`journal-page flex min-h-full flex-1 flex-col transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0${
        moodReaction ? ` journal-page--${moodReaction}` : ""
      } ${isSidebarOpen ? "md:pl-72" : "md:pl-[4.5rem]"}`}
      style={{ "--mood-strength": moodStrength } as CSSProperties}
      data-teddy-reaction={teddyReaction ?? undefined}
    >
      {saveMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="journal-toast fixed top-5 right-4 left-4 z-[60] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-white/70 bg-journal-surface/95 px-4 py-3 text-journal-text shadow-[0_16px_45px_-18px_rgba(24,61,41,0.65)] backdrop-blur-md sm:right-6 sm:left-auto sm:mx-0"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-journal-bg text-journal-text"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path
                d="m7 12.5 3.2 3.2L17.5 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-semibold">{saveMessage}</span>
            <span className="block text-xs text-journal-muted">
              Your thoughts are safely stored.
            </span>
          </span>
        </div>
      ) : null}

      <TeddyReaction reaction={teddyReaction} />

      <button
        type="button"
        aria-label={isSidebarOpen ? "Close journal history" : "Open journal history"}
        aria-controls="journal-history-sidebar"
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen((current) => !current)}
        className="fixed top-5 left-5 z-50 grid size-11 place-items-center rounded-full border border-journal-border bg-journal-surface/95 shadow-lg backdrop-blur transition hover:border-journal-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text md:hidden"
      >
        <span className="sr-only">
          {isSidebarOpen ? "Close journal history" : "Open journal history"}
        </span>
        <span aria-hidden className="flex w-5 flex-col gap-1.5">
          <span
            className={`h-0.5 w-full rounded-full bg-journal-text transition ${
              isSidebarOpen ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-full rounded-full bg-journal-text transition ${
              isSidebarOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-0.5 w-full rounded-full bg-journal-text transition ${
              isSidebarOpen ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      <button
        type="button"
        aria-label="Close journal history"
        tabIndex={isSidebarOpen ? 0 : -1}
        onClick={() => setIsSidebarOpen(false)}
        className={`fixed inset-0 z-30 bg-[#173c2a]/30 backdrop-blur-[2px] transition-opacity md:hidden ${
          isSidebarOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="journal-history-sidebar"
        aria-label="Journal history"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(88vw,18rem)] flex-col overflow-hidden border-r backdrop-blur-xl transition-[width,transform,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0 md:translate-x-0 ${
          isSidebarOpen
            ? "translate-x-0 border-journal-border bg-[#eff9f3]/98 shadow-2xl md:w-72 md:shadow-none"
            : "-translate-x-full border-transparent bg-transparent shadow-none md:w-[4.5rem]"
        }`}
      >
        <header className="shrink-0 px-3 pt-4 pb-3">
          <div className="flex h-11 items-center gap-3 pl-14 md:pl-0">
            <button
              type="button"
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((current) => !current)}
              className={`hidden size-11 shrink-0 place-items-center rounded-full text-journal-text transition-all duration-300 focus-visible:outline-2 focus-visible:outline-journal-text md:grid ${
                isSidebarOpen
                  ? "hover:bg-journal-bg"
                  : "border border-journal-border bg-journal-surface/90 shadow-md backdrop-blur hover:-translate-y-0.5 hover:border-journal-muted hover:shadow-lg"
              }`}
            >
              <span aria-hidden className="flex w-5 flex-col gap-1.5">
                <span className="h-0.5 w-full rounded-full bg-current" />
                <span className="h-0.5 w-full rounded-full bg-current" />
                <span className="h-0.5 w-full rounded-full bg-current" />
              </span>
            </button>
            {isSidebarOpen ? (
              <span className="truncate text-lg font-semibold text-journal-text">
                My Journal
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleNewEntry}
            className={`mt-3 flex h-11 items-center rounded-full text-sm font-semibold text-journal-text transition hover:bg-journal-bg focus-visible:outline-2 focus-visible:outline-journal-text ${
              isSidebarOpen
                ? "w-full gap-3 bg-journal-bg/70 px-3"
                : "w-11 justify-center border border-journal-border bg-journal-surface/90 px-0 shadow-md backdrop-blur hover:-translate-y-0.5 hover:border-journal-muted hover:shadow-lg"
            }`}
            aria-label="Create a new journal entry"
            title="New entry"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-5 shrink-0"
            >
              <path
                d="M13.5 6.5 17.5 10.5M4 20l3.7-.8L19.1 7.8a2.1 2.1 0 0 0-3-3L4.8 16.2 4 20Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isSidebarOpen ? <span>New entry</span> : null}
          </button>
        </header>

        <div
          className={`scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 ${
            isSidebarOpen
              ? "visible"
              : "invisible pointer-events-none overflow-hidden px-0"
          }`}
        >
          <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-journal-muted uppercase">
            Recent
          </p>
          {isLoadingEntries ? (
            <p className="px-2 text-sm text-journal-muted">
              Loading your journal…
            </p>
          ) : entries.length === 0 ? (
            <p className="px-2 text-sm leading-6 text-journal-muted">
              Your saved entries will appear here.
            </p>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  aria-pressed={selectedEntry?.id === entry.id}
                  onClick={() => handleSelectEntry(entry)}
                  title={formatJournalTooltipDate(new Date(entry.createdAt))}
                  className={`flex h-11 w-full items-center overflow-hidden rounded-full px-3 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-journal-text ${
                    selectedEntry?.id === entry.id
                      ? "bg-journal-bg text-journal-text"
                      : "text-journal-text hover:bg-journal-bg/65"
                  }`}
                >
                  <p className="truncate">{entry.plainText}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer
          className={`shrink-0 space-y-3 px-3 py-4 transition-colors duration-300 ${
            isSidebarOpen
              ? "border-t border-journal-border bg-[#eff9f3]"
              : "border-t border-transparent bg-transparent"
          }`}
        >
          <div
            className={`flex h-10 items-center text-sm font-medium text-journal-text ${
              isSidebarOpen ? "justify-between px-2" : "justify-center"
            }`}
          >
            {isSidebarOpen ? (
              <>
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
              </>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={liveMoodTracking}
                onClick={handleTrackingToggle}
                title="Live mood"
                className={`grid size-11 place-items-center rounded-full border shadow-md backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-journal-text ${
                  liveMoodTracking
                    ? "border-journal-text bg-journal-text text-journal-surface"
                    : "border-journal-border bg-journal-surface/90 text-journal-text hover:border-journal-muted"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="size-5"
                >
                  <path
                    d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
                <span className="sr-only">
                  {liveMoodTracking
                    ? "Disable live mood tracking"
                    : "Enable live mood tracking"}
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Log out"
            className={`flex h-10 items-center rounded-full text-sm font-semibold text-journal-text transition hover:bg-journal-bg disabled:cursor-wait disabled:opacity-60 ${
              isSidebarOpen
                ? "w-full justify-start gap-3 px-3"
                : "w-11 justify-center border border-journal-border bg-journal-surface/90 shadow-md backdrop-blur hover:-translate-y-0.5 hover:border-journal-muted hover:shadow-lg"
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="size-5 shrink-0"
            >
              <path
                d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10m4-3 4-4-4-4m4 4H9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isSidebarOpen ? (
              <span>{isLoggingOut ? "Logging out…" : "Log out"}</span>
            ) : null}
          </button>
        </footer>
      </aside>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-20 pb-10 sm:px-6 sm:py-10 md:pt-10">
        <header>
          <div className="space-y-1 text-center sm:text-left">
            <p className="text-sm font-medium tracking-wide text-journal-muted uppercase">
              {selectedEntry ? "Saved entry" : "Today"}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-journal-text sm:text-3xl">
              {displayedDateLabel}
            </h1>
          </div>
        </header>

        <section
          aria-label="Journal entry"
          className="journal-editor-shell flex min-h-[min(50vh,420px)] flex-1 flex-col overflow-hidden rounded-3xl border border-journal-border bg-journal-surface shadow-[0_8px_32px_-8px_rgba(47,89,67,0.12)]"
        >
          <RichTextEditor
            key={
              selectedEntry ? `saved-${selectedEntry.id}` : `draft-${editorKey}`
            }
            defaultContent={selectedEntry?.content ?? editorContent}
            onChange={selectedEntry ? undefined : handleEditorContentChange}
            onTextChange={selectedEntry ? undefined : handleEditorTextChange}
            placeholder={selectedEntry ? "" : "What's on your mind today?"}
            editable={!selectedEntry}
            className="flex min-h-0 flex-1 flex-col"
            editorClassName="min-h-[min(50vh,420px)] px-6 py-5 sm:px-8 sm:py-6"
          />
        </section>

        {!selectedEntry ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="self-end rounded-full bg-journal-text px-6 py-3 text-sm font-semibold text-journal-surface shadow-[0_6px_16px_-6px_rgba(47,89,67,0.5)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(47,89,67,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-journal-text"
          >
            {isSaving ? "Saving…" : "Save to journal"}
          </button>
        ) : null}

        {journalError ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {journalError}
          </p>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {logoutError
            ? logoutError
            : journalError
              ? journalError
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
