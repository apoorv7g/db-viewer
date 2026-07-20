import { NextResponse } from "next/server";
import { getConnectionId, listDatabases, listDatabasesForConnection } from "@/lib/database";
import { listDatabasesSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = listDatabasesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const databases = await listDatabases(parsed.data.uri);
    return NextResponse.json({ databases });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list databases";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const connectionId = getConnectionId(request);
    if (!connectionId) {
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }

    const databases = await listDatabasesForConnection(connectionId);
    return NextResponse.json({ databases });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list databases";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
