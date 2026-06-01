import { NextResponse } from "next/server";
import { getConnectionId, getPoolEntry } from "@/lib/database";
import { detectSoftDeleteColumn, getTableSchema } from "@/lib/table-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const connectionId = getConnectionId(request);
  if (!connectionId || !getPoolEntry(connectionId)) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  const { tableName } = await params;
  const { searchParams } = new URL(request.url);
  const schema = searchParams.get("schema") ?? "public";

  try {
    const tableSchema = await getTableSchema(connectionId, tableName, schema);
    const softDeleteColumn = detectSoftDeleteColumn(tableSchema.columns);
    return NextResponse.json({ schema: tableSchema, softDeleteColumn });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch schema";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
