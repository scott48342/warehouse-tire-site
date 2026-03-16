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
  pool = new Pool({
    connectionString: required("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function s(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function i(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function n(v: any): number | null {
  if (v == null) return null;
  const s0 = typeof v === "string" ? v.trim() : String(v);
  if (!s0) return null;
  const x = Number(s0);
  return Number.isFinite(x) ? x : null;
}

function buildWhere({
  terrain,
  brand,
  rim,
  load,
  speed,
  priceMin,
  priceMax,
}: {
  terrain?: string;
  brand?: string;
  rim?: string;
  load?: string;
  speed?: string;
  priceMin?: number | null;
  priceMax?: number | null;
}) {
  const where: string[] = [];
  const values: any[] = [];

  if (terrain) {
    if (terrain === "all-terrain") {
      // Keep in sync with /api/wp/tires/browse
      where.push(
        `(
          lower(coalesce(t.terrain,'')) like '%all%terrain%'
          or lower(coalesce(t.tire_description,'')) like '%a/t%'
          or lower(coalesce(t.tire_description,'')) like '%all terrain%'
          or lower(coalesce(t.tire_description,'')) like '%all-terrain%'
          or lower(coalesce(t.tire_description,'')) like '%allterrain%'
          or lower(coalesce(t.tire_description,'')) like '% at %'
          or lower(coalesce(t.tire_description,'')) ~ '(^|[^a-z0-9])at([^a-z0-9]|$)'
        )`
      );
    } else if (terrain === "all-season") {
      where.push(
        `(
          lower(coalesce(t.terrain,'')) like '%all%season%'
          or lower(coalesce(t.tire_description,'')) like '%all season%'
          or lower(coalesce(t.tire_description,'')) like '%all-season%'
          or lower(coalesce(t.tire_description,'')) like '%allseason%'
          or lower(coalesce(t.tire_description,'')) like '%a/s%'
          or lower(coalesce(t.tire_description,'')) ~ '(^|[^a-z0-9])as([^a-z0-9]|$)'
        )`
      );
    } else {
      values.push(terrain.toLowerCase());
      where.push(`lower(coalesce(t.terrain,'')) = $${values.length}`);
    }
  }

  if (brand) {
    values.push(brand.toLowerCase());
    where.push(`lower(coalesce(t.brand_desc,'')) = $${values.length}`);
  }

  if (rim) {
    values.push(Number(rim));
    where.push(`t.rim_diameter_in = $${values.length}`);
  }

  if (load) {
    values.push(load.toLowerCase());
    where.push(`lower(coalesce(t.load_index,'')) = $${values.length}`);
  }

  if (speed) {
    values.push(speed.toLowerCase());
    where.push(`lower(coalesce(t.speed_rating,'')) = $${values.length}`);
  }

  if (priceMin != null) {
    values.push(priceMin);
    where.push(`coalesce(nullif(t.map_usd,0), nullif(t.msrp_usd,0)) >= $${values.length}`);
  }

  if (priceMax != null) {
    values.push(priceMax);
    where.push(`coalesce(nullif(t.map_usd,0), nullif(t.msrp_usd,0)) <= $${values.length}`);
  }

  return { where, values };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const terrain = s(url.searchParams.get("terrain"));
    const brand = s(url.searchParams.get("brand"));
    const rim = s(url.searchParams.get("rim"));
    const load = s(url.searchParams.get("load"));
    const speed = s(url.searchParams.get("speed"));
    const priceMin = n(url.searchParams.get("priceMin"));
    const priceMax = n(url.searchParams.get("priceMax"));

    // Optional: cap to avoid huge responses if data grows.
    const maxBrands = Math.min(Math.max(i(url.searchParams.get("maxBrands")) || 250, 1), 1000);

    const db = getPool();

    // Brand facet should respect *rim* (and other filters) but not brand itself.
    const wb = buildWhere({ terrain, rim, load, speed, priceMin, priceMax });
    const brandWhereSql = wb.where.length ? `where ${wb.where.join(" and ")}` : "";

    const { rows: brandRows } = await db.query({
      text: `
        select
          t.brand_desc as value,
          count(*)::int as count
        from wp_tires t
        ${brandWhereSql}
          ${brandWhereSql ? "and" : "where"} t.brand_desc is not null
          and btrim(t.brand_desc) <> ''
        group by t.brand_desc
        order by count desc, t.brand_desc asc
        limit $${wb.values.length + 1}
      `,
      values: [...wb.values, maxBrands],
    });

    // Rim facet should respect *brand* (and other filters) but not rim itself.
    const wr = buildWhere({ terrain, brand, load, speed, priceMin, priceMax });
    const rimWhereSql = wr.where.length ? `where ${wr.where.join(" and ")}` : "";

    const { rows: rimRows } = await db.query({
      text: `
        select
          t.rim_diameter_in as value,
          count(*)::int as count
        from wp_tires t
        ${rimWhereSql}
          ${rimWhereSql ? "and" : "where"} t.rim_diameter_in is not null
        group by t.rim_diameter_in
        order by t.rim_diameter_in asc
      `,
      values: wr.values,
    });

    const brands = brandRows
      .map((r: any) => ({ value: String(r.value), count: Number(r.count) }))
      .filter((x) => x.value && Number.isFinite(x.count));

    const rims = rimRows
      .map((r: any) => ({ value: Number(r.value), count: Number(r.count) }))
      .filter((x) => Number.isFinite(x.value) && Number.isFinite(x.count));

    return NextResponse.json({ brands, rims }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ brands: [], rims: [], error: e?.message || String(e) }, { status: 200 });
  }
}
