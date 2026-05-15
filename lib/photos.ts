// Photo gallery client. Talks to /api/photos which fronts Vercel Blob (image
// bytes) + Neon Postgres (metadata). Photos are shared across every device
// that visits the trip URL.

export type GalleryPhoto = {
  id: number;
  destinationId: string;
  url: string;
  createdAt: number;
};

export async function listPhotos(
  destinationId: string,
): Promise<GalleryPhoto[]> {
  const res = await fetch(
    `/api/photos?destinationId=${encodeURIComponent(destinationId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`listPhotos failed: ${res.status}`);
  return res.json();
}

export async function addPhoto(
  destinationId: string,
  file: File,
): Promise<GalleryPhoto> {
  const fd = new FormData();
  fd.append("destinationId", destinationId);
  fd.append("file", file);
  const res = await fetch("/api/photos", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`addPhoto failed: ${res.status}`);
  return res.json();
}

export async function deletePhoto(id: number): Promise<void> {
  const res = await fetch(`/api/photos?id=${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`deletePhoto failed: ${res.status}`);
}
