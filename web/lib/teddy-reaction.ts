import type { SentimentLabel } from "@/lib/journal-api";

export type TeddyReaction = "happy" | "calm" | "supportive";

export function getTeddyReaction(
  sentiment: SentimentLabel | null,
): TeddyReaction | null {
  switch (sentiment) {
    case "positive":
      return "happy";
    case "neutral":
      return "calm";
    case "negative":
      return "supportive";
    default:
      return null;
  }
}
