import { NextResponse } from "next/server";
import {
  assertWritable,
  getConnectionId,
  getPoolEntry,
  query,
} from "@/lib/database";
import { analyzeSql, isReadOnlyQuery } from "@/lib/sql-safety";
import { querySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const connectionId = getConnectionId(request);
  const entry = getPoolEntry(connectionId ?? "");
  if (!connectionId || !entry) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = querySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const { sql, confirmed } = parsed.data;
    const limit = Math.min(
      parsed.data.limit ?? entry.session.resultLimit,
      10000
    );

    const safety = analyzeSql(sql);
    if (safety.requiresConfirmation && !confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        safety,
        message: safety.message,
      });
    }

    const readOnly = isReadOnlyQuery(sql);
    if (!readOnly) {
      assertWritable(entry.session);
    }

    const start = performance.now();
    let rows: Record<string, unknown>[];
    let fields: { name: string; dataTypeID: number }[];
    let rowCount: number;
    let truncated = false;

    if (readOnly) {
      const wrappedSql = `SELECT * FROM (${sql.replace(/;+\s*$/, "")}) AS _q LIMIT $1`;
      const result = await query(connectionId, wrappedSql, [limit + 1]);
      truncated = result.rows.length > limit;
      rows = (truncated ? result.rows.slice(0, limit) : result.rows) as Record<
        string,
        unknown
      >[];
      fields = result.fields;
      rowCount = rows.length;
    } else {
      const result = await query(connectionId, sql);
      rows = result.rows as Record<string, unknown>[];
      fields = result.fields;
      rowCount = result.rowCount;
      if (rows.length > limit) {
        truncated = true;
        rows = rows.slice(0, limit);
      }
    }

    const executionTimeMs = performance.now() - start;

    return NextResponse.json({
      rows,
      fields,
      rowCount,
      executionTimeMs,
      truncated,
      readOnly,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
