import { NextResponse } from "next/server";
import { getConnectionId, getPoolEntry } from "@/lib/database";
import { listTables } from "@/lib/table-service";

export async function GET(request: Request) {
  const connectionId = getConnectionId(request);
  if (!connectionId || !getPoolEntry(connectionId)) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  try {
    const tables = await listTables(connectionId, search);
    return NextResponse.json({ tables });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list tables";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
