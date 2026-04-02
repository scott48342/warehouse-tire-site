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
    connectionString: required("POSTGRES_URL"),
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const terrain = s(url.searchParams.get("terrain"));
    const brand = s(url.searchParams.get("brand"));
    const debugMode = s(url.searchParams.get("debug"));
    const debug = debugMode === "1";

    const priceMin = n(url.searchParams.get("priceMin"));
    const priceMax = n(url.searchParams.get("priceMax"));

    const rim = s(url.searchParams.get("rim"));
    const load = s(url.searchParams.get("load"));
    const speed = s(url.searchParams.get("speed"));

    const sort = s(url.searchParams.get("sort")) || "price_asc";
    const limit = Math.min(Math.max(i(url.searchParams.get("limit")) || 60, 1), 200);

    const where: string[] = [];
    const values: any[] = [];

    if (terrain) {
      if (terrain === "all-terrain") {
        // Some feeds don't populate terrain consistently. Fall back to description token matches.
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
        // All-season appears inconsistently in the feed; fall back to common tokens.
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
      } else if (terrain === "winter") {
        where.push(
          `(
            lower(coalesce(t.terrain,'')) like '%winter%'
            or lower(coalesce(t.terrain,'')) like '%snow%'
            or lower(coalesce(t.tire_description,'')) like '%winter%'
            or lower(coalesce(t.tire_description,'')) like '%snow%'
            or lower(coalesce(t.tire_description,'')) like '%blizzak%'
            or lower(coalesce(t.tire_description,'')) like '%x-ice%'
            or lower(coalesce(t.tire_description,'')) like '%xice%'
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

    const orderBy =
      sort === "stock_desc"
        ? `coalesce(i.qoh,0) desc, t.brand_desc asc, t.sku asc`
        : sort === "price_desc"
          ? `coalesce(nullif(t.map_usd,0), nullif(t.msrp_usd,0)) desc nulls last, t.brand_desc asc, t.sku asc`
          : `coalesce(nullif(t.map_usd,0), nullif(t.msrp_usd,0)) asc nulls last, t.brand_desc asc, t.sku asc`;

    const db = getPool();

    if (debugMode === "2") {
      const { rows: info } = await db.query({
        text: `
          select
            count(*)::int as total,
            count(*) filter (where map_usd is not null and map_usd > 0)::int as map_count,
            count(*) filter (where msrp_usd is not null and msrp_usd > 0)::int as msrp_count
          from wp_tires
        `,
        values: [],
      });

      const whereSql = where.length ? `where ${where.join(" and ")}` : "";
      const { rows: matches } = await db.query({
        text: `
          select count(*)::int as matches
          from wp_tires t
          ${whereSql}
        `,
        values,
      });

      const { rows: skus } = await db.query({
        text: `
          select t.sku, t.terrain, t.tire_description, t.map_usd, t.msrp_usd
          from wp_tires t
          ${whereSql}
          order by t.sku asc
          limit 10
        `,
        values,
      });

      return NextResponse.json(
        {
          ok: true,
          debug: "2",
          input: { terrain, brand, rim, load, speed, priceMin, priceMax, sort, limit },
          whereSql,
          values,
          info: info?.[0] || null,
          matches: matches?.[0] || null,
          skus,
        },
        { status: 200 }
      );
    }

    if (debug) {
      const { rows: sample } = await db.query({
        text: `
          select terrain, tire_description
          from wp_tires
          where tire_description is not null
          order by random()
          limit 25
        `,
        values: [],
      });

      const { rows: counts } = await db.query({
        text: `
          select
            sum(case when lower(coalesce(terrain,'')) like '%all%terrain%' then 1 else 0 end)::int as terrain_matches,
            sum(case when lower(coalesce(tire_description,'')) like '%a/t%' then 1 else 0 end)::int as desc_at_slash,
            sum(case when lower(coalesce(tire_description,'')) ~ '(^|[^a-z0-9])at([^a-z0-9]|$)' then 1 else 0 end)::int as desc_at_word
          from wp_tires
        `,
        values: [],
      });

      return NextResponse.json({ ok: true, counts: counts?.[0] || null, sample }, { status: 200 });
    }

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
          t.rim_diameter_in,
          t.image_url,
          t.map_usd,
          t.msrp_usd,
          coalesce(i.qoh, 0) as qoh
        from wp_tires t
        left join wp_inventory i
          on i.sku = t.sku
         and i.product_type = 'tire'
         and i.location_id = 'TOTAL'
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by ${orderBy}
        limit $${values.length + 1}
      `,
      values: [...values, limit],
    });

    const items = rows.map((r: any) => {
      const mapUsd0 = n(r.map_usd);
      const msrpUsd0 = n(r.msrp_usd);
      const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
      const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;
      const cost = mapUsd != null ? Math.max(0.01, mapUsd - 50) : msrpUsd;

      return {
        sku: String(r.sku),
        brand: r.brand_desc || null,
        name: r.tire_description || r.tire_size || r.simple_size || r.sku,
        tireSize: r.tire_size || null,
        terrain: r.terrain || null,
        loadIndex: r.load_index || null,
        speedRating: r.speed_rating || null,
        rimDiameterIn: r.rim_diameter_in != null ? Number(r.rim_diameter_in) : null,
        imageUrl: r.image_url || null,
        priceEach: cost != null && Number.isFinite(cost) ? Number(cost) + 50 : null,
        qoh: i(r.qoh),
      };
    });

    return NextResponse.json({ items }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || String(e) }, { status: 200 });
  }
}

