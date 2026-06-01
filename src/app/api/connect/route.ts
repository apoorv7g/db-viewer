import { NextResponse } from "next/server";
import {
  createConnection,
  disconnect,
  getConnectionId,
  getPoolEntry,
  testConnection,
} from "@/lib/database";
import { connectionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = connectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const test = await testConnection(parsed.data.uri);
    if (!test.ok) {
      return NextResponse.json(
        { error: test.error ?? "Connection failed" },
        { status: 400 }
      );
    }

    const session = await createConnection(parsed.data);
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const connectionId = getConnectionId(request);
  if (!connectionId) {
    return NextResponse.json({ connected: false });
  }
  const entry = getPoolEntry(connectionId);
  if (!entry) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({ connected: true, session: entry.session });
}

export async function DELETE(request: Request) {
  const connectionId = getConnectionId(request);
  if (!connectionId) {
    return NextResponse.json({ error: "No active connection" }, { status: 400 });
  }
  await disconnect(connectionId);
  return NextResponse.json({ ok: true });
}
