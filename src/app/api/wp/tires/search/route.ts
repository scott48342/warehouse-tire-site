import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

const { Pool } = pg;

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = required("DATABASE_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function i(v: any): number {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const size = (url.searchParams.get("size") || url.searchParams.get("tireSize") || "").trim();
    const minQty = i(url.searchParams.get("minQty"));
    const limit = Math.min(Math.max(i(url.searchParams.get("limit")) || 50, 1), 200);

    if (!size) {
      return NextResponse.json({ items: [], note: "size_required" }, { status: 200 });
    }

    const db = getPool();

    const { rows } = await db.query({
      text: `
        select
          t.sku,
          t.brand_desc,
          t.tire_description,
          t.tire_size,
          t.simple_size,
          t.image_url,
          t.map_usd,
          t.msrp_usd,
          coalesce(i.qoh, 0) as qoh
        from wp_tires t
        left join wp_inventory i
          on i.sku = t.sku
         and i.product_type = 'tire'
         and i.location_id = 'TOTAL'
        where (t.simple_size = $1 or t.tire_size = $1)
          and ($2::int is null or coalesce(i.qoh, 0) >= $2::int)
        order by coalesce(i.qoh, 0) desc, t.brand_desc asc, t.sku asc
        limit $3
      `,
      values: [size, minQty || null, limit],
    });

    const items = rows.map((r) => {
      const mapUsd = n(r.map_usd);
      const msrpUsd = n(r.msrp_usd);

      // The UI displays price as (cost + 50). To show MAP directly, set cost = MAP - 50.
      // Otherwise, show MSRP + 50 by setting cost = MSRP.
      const cost = mapUsd != null ? Math.max(0, mapUsd - 50) : msrpUsd;

      return {
        partNumber: String(r.sku),
        mfgPartNumber: String(r.sku),
        brand: r.brand_desc || null,
        description: r.tire_description || r.tire_size || r.simple_size || r.sku,
        cost: cost != null && Number.isFinite(cost) ? cost : null,
        quantity: { primary: 0, alternate: 0, national: i(r.qoh) },
        imageUrl: r.image_url || null,
      };
    });

    return NextResponse.json({ items }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || String(e) }, { status: 200 });
  }
}
