export type MoodResponseRequest = {
  text: string;
};

export type MoodResponse = {
  moodScore: number;
};

export class MoodResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoodResponseError";
  }
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export async function getMoodResponse(
  text: string,
  signal?: AbortSignal,
): Promise<MoodResponse> {
  const response = await fetch(`${API_BASE}/mood-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text } satisfies MoodResponseRequest),
    signal,
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
    throw new MoodResponseError(message);
  }

  return (await response.json()) as MoodResponse;
}
