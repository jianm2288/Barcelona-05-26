"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import {
  addNote,
  deleteNote,
  listNotes,
  updateNote,
  type StickyNote,
} from "@/lib/notes";

type Props = {
  dayId: string;
  destinationId: string;
};

// Four warm post-it tints. Picked deterministically per note id so a board
// doesn't reshuffle on every re-render.
const STICKY_PALETTE = [
  "#FFF59D",
  "#FFE082",
  "#FCE4A0",
  "#FFF1B8",
];

function rotationFor(id: number): number {
  const seed = (id * 2654435761) % 0x7fffffff;
  const norm = (seed / 0x7fffffff) * 2 - 1;
  return Math.round(norm * 5 * 10) / 10; // ±5°
}

function colorFor(id: number): string {
  const seed = (id * 1597463007) % 0x7fffffff;
  return STICKY_PALETTE[seed % STICKY_PALETTE.length];
}

export function StopNotes({ dayId, destinationId }: Props) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotes([]);
    setComposing(false);
    setDraft("");
    setEditingId(null);
    setEditingText("");
    listNotes(dayId, destinationId)
      .then((rows) => {
        if (alive) setNotes(rows);
      })
      .catch(() => {
        if (alive) setNotes([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dayId, destinationId]);

  useEffect(() => {
    if (composing) composerRef.current?.focus();
  }, [composing]);

  useEffect(() => {
    if (editingId !== null) editorRef.current?.focus();
  }, [editingId]);

  const saveDraft = async () => {
    const text = draft.trim();
    setComposing(false);
    setDraft("");
    if (!text) return;
    try {
      const created = await addNote(dayId, destinationId, text);
      setNotes((prev) => [...prev, created]);
    } catch {
      // ignore individual failures
    }
  };

  const cancelDraft = () => {
    setComposing(false);
    setDraft("");
  };

  const startEdit = (n: StickyNote) => {
    setEditingId(n.id);
    setEditingText(n.text);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const id = editingId;
    const text = editingText.trim();
    setEditingId(null);
    setEditingText("");
    if (!text) {
      try {
        await deleteNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } catch {}
      return;
    }
    try {
      await updateNote(id, text);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, text, updatedAt: Date.now() } : n,
        ),
      );
    } catch {}
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  return (
    <section className="mt-6">
      <h3 className="text-caption-strong uppercase tracking-[0.12em] text-ink-48">
        Notes
      </h3>
      <div className="mt-3 flex flex-wrap gap-y-3 pr-6">
        {composing ? (
          <div
            className="sticky-card sticky-draft"
            style={{ marginLeft: 0, zIndex: 200 }}
          >
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  saveDraft();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelDraft();
                }
              }}
              placeholder="Write a note…"
              className="sticky-textarea"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="sticky-card sticky-add"
            aria-label="Add note"
          >
            <Plus size={20} weight="bold" />
            <span>Add note</span>
          </button>
        )}

        {!loading &&
          notes.map((n, i) => {
            const isEditing = editingId === n.id;
            return (
              <div
                key={n.id}
                className="sticky-card sticky-note group"
                style={{
                  transform: isEditing
                    ? "rotate(0deg) scale(1.04)"
                    : `rotate(${rotationFor(n.id)}deg)`,
                  marginLeft: i === 0 ? 16 : -12,
                  zIndex: isEditing ? 200 : 10 + i,
                  backgroundColor: colorFor(n.id),
                }}
                onClick={() => {
                  if (!isEditing) startEdit(n);
                }}
                role="button"
                tabIndex={0}
              >
                {isEditing ? (
                  <textarea
                    ref={editorRef}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={saveEdit}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className="sticky-textarea"
                  />
                ) : (
                  <p className="sticky-text">{n.text}</p>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(n.id);
                    }}
                    aria-label="Remove note"
                    className="album-remove"
                  >
                    <X size={12} weight="bold" />
                  </button>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
