import { publicApiFetch } from "@/lib/api/client";

export type MoodResponseRequest = {
  text: string;
};

export type MoodResponse = {
  moodScore: number;
};

export async function getMoodResponse(
  text: string,
  signal?: AbortSignal,
): Promise<MoodResponse> {
  const response = await publicApiFetch(
    "/mood-response",
    {
      method: "POST",
      body: JSON.stringify({ text } satisfies MoodResponseRequest),
      signal,
    },
    "Could not analyze sentiment.",
  );

  return (await response.json()) as MoodResponse;
}
