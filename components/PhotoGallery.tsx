"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import {
  addPhoto,
  deletePhoto,
  listPhotos,
  type GalleryPhoto,
} from "@/lib/photos";

type Props = {
  destinationId: string;
};

// Deterministic small-angle rotation per photo id so an album doesn't shuffle
// on every re-render. Range ≈ [-9°, +9°] with a few zero-ish values mixed in
// to keep some prints near-straight.
function rotationFor(id: number): number {
  const seed = (id * 2654435761) % 0x7fffffff;
  const norm = (seed / 0x7fffffff) * 2 - 1; // [-1, 1]
  return Math.round(norm * 9 * 10) / 10;
}

// Small horizontal stagger so each card peeks slightly differently above its
// neighbor. Independent from rotation so the look stays organic.
function stackOffsetFor(id: number): number {
  const seed = (id * 1597463007) % 0x7fffffff;
  const norm = (seed / 0x7fffffff) * 2 - 1;
  return Math.round(norm * 3);
}

export function PhotoGallery({ destinationId }: Props) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPhotos([]);
    listPhotos(destinationId)
      .then((rows) => {
        if (alive) setPhotos(rows);
      })
      .catch(() => {
        if (alive) setPhotos([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [destinationId]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: GalleryPhoto[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const p = await addPhoto(destinationId, f);
        added.push(p);
      } catch {
        // ignore individual failures
      }
    }
    if (added.length) setPhotos((prev) => [...prev, ...added]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: number) => {
    await deletePhoto(id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <section className="mt-6">
      <h3 className="text-caption-strong uppercase tracking-[0.12em] text-ink-48">
        Photos
      </h3>
      <div className="mt-3 flex flex-wrap gap-x-[-12px] gap-y-3 pl-0 pr-6">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="album-card album-add"
          aria-label="Add photo"
        >
          <Plus size={20} weight="bold" />
          <span>Add photo</span>
        </button>

        {!loading &&
          photos.map((p, i) => (
            <div
              key={p.id}
              className="album-card album-photo group"
              style={{
                transform: `rotate(${rotationFor(p.id)}deg) translateX(${stackOffsetFor(p.id)}px)`,
                marginLeft: i === 0 ? -8 : -16,
                zIndex: 10 + i,
              }}
            >
              <img
                src={p.url}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                aria-label="Remove photo"
                className="album-remove"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </section>
  );
}
