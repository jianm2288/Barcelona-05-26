import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const body = (await request.json()) as { text?: string };
  if (typeof body.text !== "string") {
    return Response.json({ error: "text required" }, { status: 400 });
  }
  await sql`
    UPDATE stickies
    SET text = ${body.text}, updated_at = now()
    WHERE id = ${id}
  `;
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  await sql`DELETE FROM stickies WHERE id = ${id}`;
  return Response.json({ ok: true });
}
