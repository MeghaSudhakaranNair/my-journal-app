export type AnalyzeSentimentRequest = {
  text: string;
};

export type AnalyzeSentimentResponse = {
  sentimentScore: number;
};

export class AnalyzeSentimentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyzeSentimentError";
  }
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export async function analyzeSentiment(
  text: string,
): Promise<AnalyzeSentimentResponse> {
  const response = await fetch(`${API_BASE}/analyzeSentiment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text } satisfies AnalyzeSentimentRequest),
  });

  if (!response.ok) {
    let message = "Could not analyze sentiment.";
    try {
      const body = (await response.json()) as {
        error?: string;
        detail?: string | { msg: string }[];
      };
      if (body.error) message = body.error;
      else if (typeof body.detail === "string") message = body.detail;
    } catch {
      /* use default message */
    }
    throw new AnalyzeSentimentError(message);
  }

  return (await response.json()) as AnalyzeSentimentResponse;
}
