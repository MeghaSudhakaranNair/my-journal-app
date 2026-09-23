"use client";

import {
  getJournalEntries,
  type JournalEntry,
  type SentimentLabel,
} from "@/lib/journal-api";
import { scaleLinear, scaleTime } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { useEffect, useMemo, useState } from "react";

const LABEL_SCORE: Record<SentimentLabel, number> = {
  negative: -1,
  neutral: 0,
  positive: 1,
};

const POINT_COLOR: Record<SentimentLabel, string> = {
  negative: "#c8796f",
  neutral: "#b8a66b",
  positive: "#4f9a72",
};

function sentimentValue(entry: JournalEntry) {
  if (entry.sentimentScores) {
    return entry.sentimentScores.positive - entry.sentimentScores.negative;
  }
  if (entry.sentimentLabel) return LABEL_SCORE[entry.sentimentLabel];
  return entry.moodScore;
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function MoodAnalyticsSection() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJournalEntries(100)
      .then((result) => {
        if (active) setEntries(result);
      })
      .catch(() => {
        if (active) setError("We could not load your mood history.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const observations = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          date: new Date(entry.createdAt),
          value: sentimentValue(entry),
        }))
        .filter(
          (item): item is {
            entry: JournalEntry;
            date: Date;
            value: number;
          } => item.value !== null,
        )
        .reverse(),
    [entries],
  );

  const chart = useMemo(() => {
    const width = 760;
    const height = 330;
    const margin = { top: 24, right: 24, bottom: 46, left: 58 };
    const firstDate = observations[0]?.date ?? new Date();
    const lastDate = observations.at(-1)?.date ?? firstDate;
    const sameTime = firstDate.getTime() === lastDate.getTime();
    const halfDay = 12 * 60 * 60 * 1000;
    const domainStart = sameTime
      ? new Date(firstDate.getTime() - halfDay)
      : firstDate;
    const domainEnd = sameTime
      ? new Date(lastDate.getTime() + halfDay)
      : lastDate;

    const xScale = scaleTime()
      .domain([domainStart, domainEnd])
      .range([margin.left, width - margin.right]);
    const yScale = scaleLinear()
      .domain([-1, 1])
      .range([height - margin.bottom, margin.top]);
    const plotted = observations.map((observation) => ({
      ...observation,
      x: xScale(observation.date),
      y: yScale(observation.value),
    }));
    const curve = line<(typeof plotted)[number]>()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(curveMonotoneX);
    const fill = area<(typeof plotted)[number]>()
      .x((point) => point.x)
      .y0(yScale(-1))
      .y1((point) => point.y)
      .curve(curveMonotoneX);

    return {
      width,
      height,
      margin,
      points: plotted,
      linePath: curve(plotted) ?? "",
      areaPath: fill(plotted) ?? "",
      xTicks: xScale
        .ticks(Math.min(5, Math.max(2, observations.length)))
        .map((date) => ({ date, x: xScale(date) })),
      yScale,
    };
  }, [observations]);

  const counts = entries.reduce<Record<SentimentLabel, number>>(
    (total, entry) => {
      if (entry.sentimentLabel) total[entry.sentimentLabel] += 1;
      return total;
    },
    { negative: 0, neutral: 0, positive: 0 },
  );
  const average = observations.length
    ? observations.reduce((sum, item) => sum + item.value, 0) /
      observations.length
    : null;
  const hoveredPoint = chart.points.find(
    (point) => point.entry.id === hoveredId,
  );

  return (
    <main className="rounded-[2rem] border border-white/75 bg-journal-surface/90 p-5 shadow-[0_22px_70px_-40px_rgba(47,89,67,0.55)] backdrop-blur-xl sm:p-8 lg:p-10">
      <header className="border-b border-journal-border pb-7">
        <p className="text-sm font-semibold tracking-[0.14em] text-journal-muted uppercase">
          Profile
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Mood analytics
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-journal-muted">
          See how the sentiment expressed in your saved journal entries changes
          over time.
        </p>
      </header>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-journal-muted">
          Loading your mood history…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="py-16 text-center text-sm font-medium text-red-700"
        >
          {error}
        </p>
      ) : null}
      {!isLoading && !error && observations.length === 0 ? (
        <p className="py-16 text-center text-sm text-journal-muted">
          Save entries with sentiment analysis to begin your mood trend.
        </p>
      ) : null}

      {!isLoading && !error && observations.length > 0 ? (
        <div className="mt-8 space-y-7">
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              ["Entries", observations.length, "bg-journal-bg/70"],
              ["Positive", counts.positive, "bg-[#e4f5e9]"],
              ["Neutral", counts.neutral, "bg-[#f2f3e8]"],
              ["Negative", counts.negative, "bg-[#f6e8e5]"],
            ].map(([label, value, background]) => (
              <div
                key={String(label)}
                className={`rounded-2xl p-4 ${background}`}
              >
                <p className="text-xs font-semibold text-journal-muted uppercase">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-journal-border bg-white/70 p-4 shadow-[0_16px_45px_-35px_rgba(47,89,67,0.45)] sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Sentiment trend</h2>
                <p className="mt-1 text-xs text-journal-muted">
                  Positive probability minus negative probability
                </p>
              </div>
              <p className="rounded-full bg-journal-bg px-3 py-1.5 text-sm font-semibold">
                Average: {average !== null ? average.toFixed(2) : "—"}
              </p>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl bg-[linear-gradient(180deg,rgba(228,245,233,0.5),rgba(255,255,255,0.7)_48%,rgba(246,232,229,0.42))]">
              <svg
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="A chronological line graph of journal sentiment from negative to positive"
                className="w-full min-w-[40rem]"
              >
                <defs>
                  <linearGradient id="sentiment-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67b889" stopOpacity="0.38" />
                    <stop offset="52%" stopColor="#9edfb8" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#d9988f" stopOpacity="0.1" />
                  </linearGradient>
                  <filter id="sentiment-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#2f5943" floodOpacity="0.2" />
                  </filter>
                </defs>

                {[1, 0, -1].map((value) => {
                  const y = chart.yScale(value);
                  return (
                    <g key={value}>
                      <line x1={chart.margin.left} x2={chart.width - chart.margin.right} y1={y} y2={y} stroke={value === 0 ? "#91bda4" : "#c5ecd6"} strokeDasharray={value === 0 ? "6 6" : "2 7"} />
                      <text x={chart.margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#6b9b82">
                        {value === 1 ? "Positive" : value === 0 ? "Neutral" : "Negative"}
                      </text>
                    </g>
                  );
                })}

                {chart.xTicks.map((tick) => (
                  <text key={tick.date.toISOString()} x={tick.x} y={chart.height - 14} textAnchor="middle" fontSize="11" fill="#6b9b82">
                    {shortDate(tick.date)}
                  </text>
                ))}

                <path d={chart.areaPath} fill="url(#sentiment-area)" />
                <path d={chart.linePath} fill="none" stroke="#2f5943" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#sentiment-shadow)" />

                {chart.points.map((point) => {
                  const label = point.entry.sentimentLabel ?? "neutral";
                  return (
                    <g
                      key={point.entry.id}
                      tabIndex={0}
                      role="img"
                      aria-label={`${shortDate(point.date)}, ${label}, sentiment score ${point.value.toFixed(2)}`}
                      onMouseEnter={() => setHoveredId(point.entry.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(point.entry.id)}
                      onBlur={() => setHoveredId(null)}
                      className="cursor-pointer outline-none"
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="14"
                        fill="transparent"
                      />
                    </g>
                  );
                })}

                {hoveredPoint ? (() => {
                  const tooltipWidth = 158;
                  const tooltipHeight = 54;
                  const tooltipX = hoveredPoint.x > chart.width - tooltipWidth - 24
                    ? hoveredPoint.x - tooltipWidth - 12
                    : hoveredPoint.x + 12;
                  const tooltipY = Math.max(12, hoveredPoint.y - tooltipHeight - 12);
                  return (
                    <g pointerEvents="none" transform={`translate(${tooltipX} ${tooltipY})`}>
                      <rect width={tooltipWidth} height={tooltipHeight} rx="12" fill="#2f5943" opacity="0.96" />
                      <text x="12" y="21" fontSize="11" fontWeight="700" fill="#f9fefb">{shortDate(hoveredPoint.date)}</text>
                      <text x="12" y="40" fontSize="11" fill="#dff5e8">{`${hoveredPoint.entry.sentimentLabel ?? "Mood"} · ${hoveredPoint.value.toFixed(2)}`}</text>
                    </g>
                  );
                })() : null}
              </svg>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-medium text-journal-muted">
              {(["positive", "neutral", "negative"] as const).map((label) => (
                <span key={label} className="flex items-center gap-1.5 capitalize">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: POINT_COLOR[label] }} />
                  {label}
                </span>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
