import { NextResponse } from "next/server";
import {
  assertWritable,
  getConnectionId,
  getPoolEntry,
} from "@/lib/database";
import {
  deleteRows,
  getTableData,
  insertRows,
  updateRows,
} from "@/lib/table-service";
import {
  deleteDataSchema,
  insertDataSchema,
  tableDataQuerySchema,
  updateDataSchema,
} from "@/lib/validation";

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
  const parsed = tableDataQuerySchema.safeParse(
    Object.fromEntries(searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  try {
    const data = await getTableData(connectionId, tableName, parsed.data);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const connectionId = getConnectionId(request);
  const entry = getPoolEntry(connectionId ?? "");
  if (!connectionId || !entry) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    assertWritable(entry.session);
    const body = await request.json();
    const parsed = insertDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    if (!parsed.data.confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        message: `Are you sure you want to insert ${parsed.data.rows.length} new row(s)?`,
        preview: parsed.data.rows,
      });
    }

    const count = await insertRows(
      connectionId,
      (await params).tableName,
      parsed.data.rows,
      parsed.data.schema
    );
    return NextResponse.json({ inserted: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insert failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const connectionId = getConnectionId(request);
  const entry = getPoolEntry(connectionId ?? "");
  if (!connectionId || !entry) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    assertWritable(entry.session);
    const body = await request.json();
    const parsed = updateDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    if (!parsed.data.confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        message: "Are you sure you want to update this row?",
        preview: { data: parsed.data.data, where: parsed.data.where },
      });
    }

    const count = await updateRows(
      connectionId,
      (await params).tableName,
      parsed.data.data,
      parsed.data.where,
      parsed.data.schema
    );
    return NextResponse.json({ updated: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableName: string }> }
) {
  const connectionId = getConnectionId(request);
  const entry = getPoolEntry(connectionId ?? "");
  if (!connectionId || !entry) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    assertWritable(entry.session);
    const body = await request.json();
    const parsed = deleteDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const whereList = Array.isArray(parsed.data.where)
      ? parsed.data.where
      : [parsed.data.where];

    if (!parsed.data.confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        message: `Are you sure you want to delete ${whereList.length} row(s)? This action cannot be undone.`,
        preview: whereList,
      });
    }

    const count = await deleteRows(
      connectionId,
      (await params).tableName,
      whereList,
      parsed.data.schema
    );
    return NextResponse.json({ deleted: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
