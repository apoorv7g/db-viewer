import { NextResponse } from "next/server";
import { getConnectionId, switchDatabase } from "@/lib/database";
import { switchDatabaseSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const connectionId = getConnectionId(request);
    if (!connectionId) {
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = switchDatabaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const session = await switchDatabase(connectionId, parsed.data.database);
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to switch database";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
