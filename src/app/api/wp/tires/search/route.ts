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
    const sizeRaw = (url.searchParams.get("size") || url.searchParams.get("tireSize") || "").trim();

    function toSimpleSize(s: string) {
      // Accept formats like:
      // - 245/50R18
      // - 245/40ZR20 95Y
      // - 2455018
      const v = String(s || "").trim().toUpperCase();
      const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R\s*(\d{2})/i);
      if (m) return `${m[1]}${m[2]}${m[3]}`;
      const m2 = v.match(/^(\d{7})$/);
      if (m2) return m2[1];
      return "";
    }

    const simple = toSimpleSize(sizeRaw);
    const size = simple || sizeRaw;
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
          t.terrain,
          t.construction_type,
          t.mileage_warranty,
          t.load_index,
          t.speed_rating,
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
      const mapUsd0 = n(r.map_usd);
      const msrpUsd0 = n(r.msrp_usd);

      // Treat 0/blank as missing (some feeds use 0 when price not available)
      const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
      const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;

      // The UI displays price as (cost + 50).
      // To show MAP directly, set cost = MAP - 50.
      // Otherwise, show MSRP + 50 by setting cost = MSRP.
      const cost = mapUsd != null ? Math.max(0.01, mapUsd - 50) : msrpUsd;

      return {
        partNumber: String(r.sku),
        mfgPartNumber: String(r.sku),
        brand: r.brand_desc || null,
        description: r.tire_description || r.tire_size || r.simple_size || r.sku,
        cost: cost != null && Number.isFinite(cost) ? cost : null,
        quantity: { primary: 0, alternate: 0, national: i(r.qoh) },
        imageUrl: r.image_url || null,
        badges: {
          terrain: r.terrain || null,
          construction: r.construction_type || null,
          warrantyMiles: r.mileage_warranty != null ? i(r.mileage_warranty) : null,
          loadIndex: r.load_index || null,
          speedRating: r.speed_rating || null,
        },
      };
    });

    return NextResponse.json({ items }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || String(e) }, { status: 200 });
  }
}
