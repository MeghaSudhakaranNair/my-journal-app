import { authenticatedApiFetch } from "@/lib/api/client";
import type { JSONContent } from "@tiptap/react";

export type JournalEntry = {
  id: string;
  userId: string;
  content: JSONContent;
  plainText: string;
  moodScore: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AddJournalEntryRequest = {
  content: JSONContent;
  plainText: string;
  moodScore: number | null;
};

export async function addJournalEntry(
  body: AddJournalEntryRequest,
): Promise<JournalEntry> {
  const response = await authenticatedApiFetch(
    "/addjournal",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    "We could not save your journal entry.",
  );
  return (await response.json()) as JournalEntry;
}

export async function getJournalEntries(
  limit = 20,
): Promise<JournalEntry[]> {
  const response = await authenticatedApiFetch(
    `/getjournal?limit=${limit}`,
    undefined,
    "We could not load your journal entries.",
  );
  return (await response.json()) as JournalEntry[];
}
