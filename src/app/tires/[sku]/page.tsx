import Link from "next/link";
import { NextResponse } from "next/server";
import pg from "pg";
import { BRAND } from "@/lib/brand";

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

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

export default async function TireDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const safeSku = String(sku || "").trim();

  if (!safeSku) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">SKU required.</div>
        </div>
      </main>
    );
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
        t.section_width,
        t.series,
        t.rim_diameter_in,
        t.tire_diameter_in,
        t.image_url,
        t.map_usd,
        t.msrp_usd,
        coalesce(i.qoh, 0) as qoh
      from wp_tires t
      left join wp_inventory i
        on i.sku = t.sku
       and i.product_type = 'tire'
       and i.location_id = 'TOTAL'
      where t.sku = $1
      limit 1
    `,
    values: [safeSku],
  });

  const t = rows[0] || null;
  if (!t) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Tire not found (SKU: {safeSku}).
          </div>
          <div className="mt-4">
            <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
              ← Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const mapUsd = n(t.map_usd);
  const msrpUsd = n(t.msrp_usd);
  const displayPrice = mapUsd ?? (msrpUsd != null ? msrpUsd + 50 : null);

  const title = String(t.tire_description || t.tire_size || t.simple_size || t.sku);
  const aboutParts: string[] = [];
  if (t.tire_size) aboutParts.push(String(t.tire_size));
  if (t.terrain) aboutParts.push(String(t.terrain));
  if (t.construction_type) aboutParts.push(String(t.construction_type));
  if (t.mileage_warranty) aboutParts.push(`${t.mileage_warranty} mi warranty`);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
            ← Back to tires
          </Link>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {t.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(t.image_url)}
                  alt={title}
                  className="h-[360px] w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="p-6 text-sm text-neutral-700">No image</div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">{String(t.brand_desc || "Tire")}</div>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{title}</h1>

            <div className="mt-4">
              <div className="text-3xl font-extrabold text-neutral-900">
                {displayPrice != null ? fmtMoney(displayPrice) : "Call for price"}
              </div>
              <div className="text-xs text-neutral-600">each</div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-extrabold text-neutral-900">About this tire</div>
                <p className="mt-2 text-sm text-neutral-700">
                  {aboutParts.length ? aboutParts.join(" • ") : "Specs and fitment details coming soon."}
                </p>

                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                  {t.load_index ? <li>Load index: {String(t.load_index)}</li> : null}
                  {t.speed_rating ? <li>Speed rating: {String(t.speed_rating)}</li> : null}
                  {t.rim_diameter_in != null ? <li>Wheel diameter: {String(t.rim_diameter_in)} in</li> : null}
                  {t.section_width != null ? <li>Section width: {String(t.section_width)} mm</li> : null}
                  {t.series != null ? <li>Aspect ratio: {String(t.series)}</li> : null}
                </ul>
              </div>

              <div className="grid gap-2">
                {displayPrice != null ? (
                  <Link
                    href="/schedule"
                    className="h-11 rounded-xl bg-[var(--brand-red)] px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                  >
                    Schedule Install
                  </Link>
                ) : (
                  <a
                    href={BRAND.links.tel}
                    className="h-11 rounded-xl bg-[var(--brand-red)] px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                  >
                    Call for price
                  </a>
                )}

                <div className="flex items-center justify-between gap-3 text-xs">
                  <a href={BRAND.links.tel} className="font-extrabold text-neutral-900 hover:underline">
                    Call
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-600">Part / SKU: {safeSku}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
