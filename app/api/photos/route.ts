import { neon } from "@neondatabase/serverless";
import { del, put } from "@vercel/blob";

const sql = neon(process.env.DATABASE_URL!);

export const runtime = "nodejs";
// Default Vercel Function body limit is 4.5 MB; trip photos from phones can
// brush against this. If the user starts hitting failed uploads we'd swap to
// the @vercel/blob/client upload pattern.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destinationId = searchParams.get("destinationId");
  if (!destinationId) {
    return Response.json(
      { error: "destinationId required" },
      { status: 400 },
    );
  }
  const rows = await sql`
    SELECT id, destination_id, blob_url, created_at
    FROM photos
    WHERE destination_id = ${destinationId}
    ORDER BY created_at ASC
  `;
  return Response.json(
    rows.map((r) => ({
      id: Number(r.id),
      destinationId: r.destination_id as string,
      url: r.blob_url as string,
      createdAt: new Date(r.created_at as string).getTime(),
    })),
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const destinationId = formData.get("destinationId");
  const file = formData.get("file");
  if (typeof destinationId !== "string" || !destinationId) {
    return Response.json(
      { error: "destinationId required" },
      { status: 400 },
    );
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  const safeName = (file.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
  const blob = await put(`photos/${destinationId}/${safeName}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || undefined,
  });
  const rows = await sql`
    INSERT INTO photos (destination_id, blob_url, blob_pathname, content_type)
    VALUES (${destinationId}, ${blob.url}, ${blob.pathname}, ${file.type || null})
    RETURNING id, created_at
  `;
  const row = rows[0];
  return Response.json({
    id: Number(row.id),
    destinationId,
    url: blob.url,
    createdAt: new Date(row.created_at as string).getTime(),
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");
  const id = idParam ? Number(idParam) : NaN;
  if (!Number.isFinite(id)) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  const rows = await sql`SELECT blob_url FROM photos WHERE id = ${id}`;
  if (rows.length > 0) {
    // Best-effort: Blob delete failure shouldn't block the metadata cleanup.
    try {
      await del(rows[0].blob_url as string);
    } catch {}
  }
  await sql`DELETE FROM photos WHERE id = ${id}`;
  return Response.json({ ok: true });
}
