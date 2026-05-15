// Sticky-note client. Talks to /api/notes which is backed by Neon Postgres.
// Notes are shared across every device that visits the trip URL.

export type StickyNote = {
  id: number;
  text: string;
  createdAt: number;
  updatedAt: number;
};

export async function listNotes(
  dayId: string,
  destinationId: string,
): Promise<StickyNote[]> {
  const params = new URLSearchParams({ dayId, destinationId });
  const res = await fetch(`/api/notes?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`listNotes failed: ${res.status}`);
  return res.json();
}

export async function addNote(
  dayId: string,
  destinationId: string,
  text: string,
): Promise<StickyNote> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dayId, destinationId, text }),
  });
  if (!res.ok) throw new Error(`addNote failed: ${res.status}`);
  return res.json();
}

export async function updateNote(id: number, text: string): Promise<void> {
  const res = await fetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`updateNote failed: ${res.status}`);
}

export async function deleteNote(id: number): Promise<void> {
  const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deleteNote failed: ${res.status}`);
}

// Used by the day overview to flag stops that already carry notes.
export async function listNotedDestinations(
  dayId: string,
): Promise<Set<string>> {
  const params = new URLSearchParams({
    dayId,
    summary: "noted_destinations",
  });
  const res = await fetch(`/api/notes?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return new Set();
  const arr = (await res.json()) as string[];
  return new Set(arr);
}
