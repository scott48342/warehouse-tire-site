import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

/**
 * Get admin logs with filters
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const logType = url.searchParams.get("type"); // fitment, inventory, search_error, warning, fitment_override, product_flag
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const pool = getPool();
  try {
    let whereClause = "";
    const values: any[] = [];

    if (logType) {
      whereClause = "WHERE log_type = $1";
      values.push(logType);
    }

    values.push(limit, offset);
    const limitIdx = values.length - 1;

    const { rows: logs } = await pool.query(`
      SELECT *
      FROM admin_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `, values);

    // Get counts by type
    const { rows: countRows } = await pool.query(`
      SELECT log_type, COUNT(*) as count
      FROM admin_logs
      GROUP BY log_type
      ORDER BY count DESC
    `);

    const counts: Record<string, number> = {};
    for (const row of countRows) {
      counts[row.log_type] = parseInt(row.count, 10);
    }

    // Get total count
    const { rows: totalRows } = await pool.query(`
      SELECT COUNT(*) as total FROM admin_logs ${whereClause}
    `, logType ? [logType] : []);

    return NextResponse.json({
      logs,
      counts,
      total: parseInt(totalRows[0]?.total || "0", 10),
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("[admin/logs] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Clear logs (with optional type filter)
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const logType = url.searchParams.get("type");
  const olderThanDays = parseInt(url.searchParams.get("olderThanDays") || "30", 10);

  const pool = getPool();
  try {
    let whereConditions = [`created_at < NOW() - INTERVAL '${olderThanDays} days'`];
    const values: any[] = [];

    if (logType) {
      whereConditions.push("log_type = $1");
      values.push(logType);
    }

    const { rowCount } = await pool.query(`
      DELETE FROM admin_logs
      WHERE ${whereConditions.join(" AND ")}
    `, values);

    return NextResponse.json({ ok: true, deleted: rowCount });
  } catch (err: any) {
    console.error("[admin/logs] DELETE Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
