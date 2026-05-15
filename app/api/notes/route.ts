import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayId = searchParams.get("dayId");
  const destinationId = searchParams.get("destinationId");
  const summary = searchParams.get("summary");

  if (!dayId) {
    return Response.json({ error: "dayId required" }, { status: 400 });
  }

  // Summary endpoint: which destinationIds on this day have any notes? Used by
  // the day overview to flag annotated stops with a pencil icon.
  if (summary === "noted_destinations") {
    const rows = await sql`
      SELECT DISTINCT destination_id
      FROM stickies
      WHERE day_id = ${dayId} AND text <> ''
    `;
    return Response.json(rows.map((r) => r.destination_id as string));
  }

  if (!destinationId) {
    return Response.json(
      { error: "destinationId required" },
      { status: 400 },
    );
  }
  const rows = await sql`
    SELECT id, text, created_at, updated_at
    FROM stickies
    WHERE day_id = ${dayId} AND destination_id = ${destinationId}
    ORDER BY created_at ASC
  `;
  return Response.json(
    rows.map((r) => ({
      id: Number(r.id),
      text: r.text as string,
      createdAt: new Date(r.created_at as string).getTime(),
      updatedAt: new Date(r.updated_at as string).getTime(),
    })),
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    dayId?: string;
    destinationId?: string;
    text?: string;
  };
  if (!body.dayId || !body.destinationId || typeof body.text !== "string") {
    return Response.json(
      { error: "dayId, destinationId, text required" },
      { status: 400 },
    );
  }
  const rows = await sql`
    INSERT INTO stickies (day_id, destination_id, text)
    VALUES (${body.dayId}, ${body.destinationId}, ${body.text})
    RETURNING id, created_at, updated_at
  `;
  const row = rows[0];
  return Response.json({
    id: Number(row.id),
    text: body.text,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  });
}
