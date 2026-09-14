"use client";

import { getJournalEntries, type JournalEntry, type SentimentLabel } from "@/lib/journal-api";
import { useEffect, useMemo, useState } from "react";

const LABEL_SCORE: Record<SentimentLabel, number> = { negative: -1, neutral: 0, positive: 1 };

function sentimentValue(entry: JournalEntry) {
  if (entry.sentimentScores) return entry.sentimentScores.positive - entry.sentimentScores.negative;
  if (entry.sentimentLabel) return LABEL_SCORE[entry.sentimentLabel];
  return entry.moodScore;
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function MoodAnalyticsSection() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getJournalEntries(100)
      .then((result) => { if (active) setEntries(result); })
      .catch(() => { if (active) setError("We could not load your mood history."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const observations = useMemo(
    () => entries
      .map((entry) => ({ entry, value: sentimentValue(entry) }))
      .filter((item): item is { entry: JournalEntry; value: number } => item.value !== null)
      .reverse(),
    [entries],
  );

  const chart = useMemo(() => {
    const width = 720; const height = 280; const left = 42; const right = 18; const top = 20; const bottom = 38;
    const plotWidth = width - left - right; const plotHeight = height - top - bottom;
    const points = observations.map((item, index) => ({
      ...item,
      x: observations.length === 1 ? left + plotWidth / 2 : left + (index / (observations.length - 1)) * plotWidth,
      y: top + ((1 - item.value) / 2) * plotHeight,
    }));
    return { width, height, left, right, top, bottom, plotWidth, plotHeight, points, path: points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") };
  }, [observations]);

  const counts = entries.reduce<Record<SentimentLabel, number>>((total, entry) => {
    if (entry.sentimentLabel) total[entry.sentimentLabel] += 1;
    return total;
  }, { negative: 0, neutral: 0, positive: 0 });
  const average = observations.length ? observations.reduce((sum, item) => sum + item.value, 0) / observations.length : null;

  return (
    <main className="rounded-[2rem] border border-white/75 bg-journal-surface/90 p-5 shadow-[0_22px_70px_-40px_rgba(47,89,67,0.55)] backdrop-blur-xl sm:p-8 lg:p-10">
      <header className="border-b border-journal-border pb-7">
        <p className="text-sm font-semibold tracking-[0.14em] text-journal-muted uppercase">Profile</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Mood analytics</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-journal-muted">See how the sentiment expressed in your saved journal entries changes over time.</p>
      </header>

      {isLoading ? <p className="py-16 text-center text-sm text-journal-muted">Loading your mood history…</p> : null}
      {error ? <p role="alert" className="py-16 text-center text-sm font-medium text-red-700">{error}</p> : null}
      {!isLoading && !error && observations.length === 0 ? <p className="py-16 text-center text-sm text-journal-muted">Save entries with sentiment analysis to begin your mood trend.</p> : null}

      {!isLoading && !error && observations.length > 0 ? (
        <div className="mt-8 space-y-7">
          <section className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-journal-bg/70 p-4"><p className="text-xs font-semibold text-journal-muted uppercase">Entries</p><p className="mt-1 text-2xl font-semibold">{observations.length}</p></div>
            <div className="rounded-2xl bg-[#e4f5e9] p-4"><p className="text-xs font-semibold text-journal-muted uppercase">Positive</p><p className="mt-1 text-2xl font-semibold">{counts.positive}</p></div>
            <div className="rounded-2xl bg-[#f2f3e8] p-4"><p className="text-xs font-semibold text-journal-muted uppercase">Neutral</p><p className="mt-1 text-2xl font-semibold">{counts.neutral}</p></div>
            <div className="rounded-2xl bg-[#f6e8e5] p-4"><p className="text-xs font-semibold text-journal-muted uppercase">Negative</p><p className="mt-1 text-2xl font-semibold">{counts.negative}</p></div>
          </section>

          <section className="rounded-3xl border border-journal-border bg-white/65 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Sentiment trend</h2><p className="mt-1 text-xs text-journal-muted">Positive probability minus negative probability</p></div>
              <p className="text-sm font-semibold">Average: {average !== null ? average.toFixed(2) : "—"}</p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="A chronological line graph of journal sentiment from negative to positive" className="min-w-[38rem] w-full">
                {[1, 0, -1].map((value) => {
                  const y = chart.top + ((1 - value) / 2) * chart.plotHeight;
                  return <g key={value}><line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke="#c5ecd6" strokeDasharray={value === 0 ? "5 5" : undefined} /><text x={chart.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b9b82">{value === 1 ? "Positive" : value === 0 ? "Neutral" : "Negative"}</text></g>;
                })}
                <path d={chart.path} fill="none" stroke="#2f5943" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {chart.points.map((point) => <g key={point.entry.id}><title>{`${shortDate(point.entry.createdAt)}: ${point.entry.sentimentLabel ?? "mood"} (${point.value.toFixed(2)})`}</title><circle cx={point.x} cy={point.y} r="5" fill="#f9fefb" stroke="#2f5943" strokeWidth="3" /></g>)}
                {chart.points.length ? <><text x={chart.left} y={chart.height - 10} fontSize="11" fill="#6b9b82">{shortDate(chart.points[0].entry.createdAt)}</text><text x={chart.width - chart.right} y={chart.height - 10} textAnchor="end" fontSize="11" fill="#6b9b82">{shortDate(chart.points[chart.points.length - 1].entry.createdAt)}</text></> : null}
              </svg>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
