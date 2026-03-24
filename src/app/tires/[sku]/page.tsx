import Link from "next/link";
import { NextResponse } from "next/server";
import pg from "pg";
import { BRAND } from "@/lib/brand";
import { QuoteRequest } from "@/components/QuoteRequest";
import { ImageGallery } from "@/components/ImageGallery";
import { RecommendedFitmentCard } from "@/components/RecommendedFitmentCard";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";
import { searchTiresTirewire, tirewireTireToUnified } from "@/lib/tirewire/client";

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

function priceFromRow(r: any): number | null {
  const mapUsd0 = n(r?.map_usd);
  const msrpUsd0 = n(r?.msrp_usd);
  const mapUsd = mapUsd0 != null && mapUsd0 > 0.01 ? mapUsd0 : null;
  const msrpUsd = msrpUsd0 != null && msrpUsd0 > 0.01 ? msrpUsd0 : null;
  return mapUsd ?? (msrpUsd != null ? msrpUsd + 50 : null);
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900">
      {children}
    </span>
  );
}

export default async function TireDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sku } = await params;
  const sp = (await searchParams) || {};
  const safeSku = String(sku || "").trim();

  const year = String((sp as any).year || "");
  const make = String((sp as any).make || "");
  const model = String((sp as any).model || "");
  const trim = String((sp as any).trim || "");
  const modification = String((sp as any).modification || "");

  // Quote carry-over (wheel selected on quote -> keep it when adding tires)
  const wheelSku = String((sp as any).wheelSku || "");
  const wheelName = String((sp as any).wheelName || "");
  const wheelUnit = String((sp as any).wheelUnit || "");
  const wheelQty = String((sp as any).wheelQty || "");
  const wheelDia = String((sp as any).wheelDia || "");
  // Never show raw engine text - extract clean submodel or omit
  const displayTrim = extractDisplayTrim(trim);
  const vehicleLabel = [year, make, model, displayTrim].filter(Boolean).join(" ");

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

  // Related tires (same simple size)
  const related = t
    ? await db.query({
        text: `
          select sku, brand_desc, tire_description, tire_size, simple_size, image_url, map_usd, msrp_usd
          from wp_tires
          where simple_size = $1
            and sku <> $2
          order by brand_desc nulls last, tire_description nulls last
          limit 8
        `,
        values: [String(t.simple_size || ""), safeSku],
      })
    : { rows: [] as any[] };

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

  const displayPrice = priceFromRow(t);

  // Enrich with TireLibrary image if database doesn't have one
  let enrichedImageUrl: string | null = t.image_url || null;
  
  if (!enrichedImageUrl && t.simple_size) {
    try {
      // Search Tirewire by size and find matching tire
      const tirewireResults = await searchTiresTirewire(t.simple_size);
      
      // First pass: exact SKU match
      for (const result of tirewireResults) {
        for (const tire of result.tires) {
          if (
            tire.productCode === safeSku ||
            tire.clientProductCode === safeSku ||
            tire.productCode?.toUpperCase() === safeSku.toUpperCase() ||
            tire.clientProductCode?.toUpperCase() === safeSku.toUpperCase()
          ) {
            const unified = tirewireTireToUnified(tire, result.provider);
            if (unified.imageUrl) {
              enrichedImageUrl = unified.imageUrl;
              break;
            }
          }
        }
        if (enrichedImageUrl) break;
      }
      
      // Second pass: match by brand + model name (fuzzy match)
      if (!enrichedImageUrl) {
        const wpBrand = String(t.brand_desc || "").toUpperCase().trim();
        const wpDesc = String(t.tire_description || "").toUpperCase();
        
        for (const result of tirewireResults) {
          for (const tire of result.tires) {
            const twBrand = String(tire.make || "").toUpperCase().trim();
            const twPattern = String(tire.pattern || "").toUpperCase().trim();
            
            // Match brand and check if pattern is in description
            if (twBrand === wpBrand && twPattern && wpDesc.includes(twPattern)) {
              if (tire.imageUrl) {
                enrichedImageUrl = tire.imageUrl;
                break;
              }
            }
          }
          if (enrichedImageUrl) break;
        }
      }
      
      // Third pass: just match by brand and take first image
      if (!enrichedImageUrl) {
        const wpBrand = String(t.brand_desc || "").toUpperCase().trim();
        
        for (const result of tirewireResults) {
          for (const tire of result.tires) {
            const twBrand = String(tire.make || "").toUpperCase().trim();
            if (twBrand === wpBrand && tire.imageUrl) {
              enrichedImageUrl = tire.imageUrl;
              break;
            }
          }
          if (enrichedImageUrl) break;
        }
      }
    } catch (err) {
      console.error("[tire-detail] TireLibrary enrichment failed:", err);
    }
  }

  const title = String(t.tire_description || t.tire_size || t.simple_size || t.sku);

  const badges: string[] = [];
  if (t.tire_size) badges.push(String(t.tire_size));
  if (t.terrain) badges.push(String(t.terrain));
  if (t.construction_type) badges.push(String(t.construction_type));
  if (t.mileage_warranty) badges.push(`${t.mileage_warranty} mi warranty`);
  if (t.load_index) badges.push(`Load ${String(t.load_index)}`);
  if (t.speed_rating) badges.push(`Speed ${String(t.speed_rating)}`);

  const highlights: string[] = [];
  if (t.terrain) highlights.push(`${String(t.terrain)} performance for everyday + weekend driving.`);
  if (t.mileage_warranty) highlights.push(`${String(t.mileage_warranty)}-mile warranty coverage.`);
  if (t.construction_type) highlights.push(`Built with ${String(t.construction_type)} construction for durability.`);
  if (t.tire_diameter_in != null) highlights.push(`Overall diameter: ${String(t.tire_diameter_in)} in.`);
  if (t.rim_diameter_in != null) highlights.push(`Fits ${String(t.rim_diameter_in)}" wheels.`);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
            ← Back to tires
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-neutral-600">Product photo</div>
                <div className="text-[11px] text-neutral-500">Click to zoom</div>
              </div>
              <ImageGallery images={enrichedImageUrl ? [String(enrichedImageUrl)] : []} alt={title} note="Image may vary by size" />
            </div>

            {/* Space reserved for future modules under the photo (packages, accessories, etc.) */}
          </div>

          <div className="lg:sticky lg:top-6 rounded-3xl border border-neutral-200 bg-white p-6">
            {year && make && model ? (
              <div className="mb-4">
                <RecommendedFitmentCard fitment={{ year, make, model, trim, modification }} />
                <div className="mt-2">
                  <Link
                    href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                    className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                  >
                    Change vehicle
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="text-[11px] font-semibold text-neutral-600">Vehicle</div>
                <div className="mt-0.5 text-sm font-extrabold text-neutral-900">Select vehicle to verify fitment</div>
                <div className="mt-2">
                  <Link
                    href={`/tires?${new URLSearchParams({ year, make, model, trim, modification }).toString()}`}
                    className="inline-flex h-9 items-center rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                  >
                    Select vehicle
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-4 text-xs font-semibold text-neutral-600">{String(t.brand_desc || "Tire")}</div>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{title}</h1>

            {badges.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.slice(0, 6).map((b) => (
                  <Badge key={b}>{b}</Badge>
                ))}
              </div>
            ) : null}

            <div className="mt-4">
              <div className="text-3xl font-extrabold text-neutral-900">
                {displayPrice != null ? fmtMoney(displayPrice) : "Call for price"}
              </div>
              <div className="text-xs text-neutral-600">each</div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-extrabold text-neutral-900">Why you’ll like it</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {(highlights.length ? highlights : ["Fitment and availability confirmed before install."]).slice(0, 6).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>

            {/* Fitment moved under photo */}

            <div id="quote" className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-xs font-extrabold text-neutral-900">Get your quote</div>
              <div className="mt-1 text-xs text-neutral-600">
                We’ll confirm pricing, availability, and the right fit before you commit.
              </div>

              <div className="mt-3 grid gap-2">
                <div className="flex flex-wrap gap-2">
                  <QuoteRequest productType="tire" sku={safeSku} productName={title} />
                  <Link
                    href={
                      `/quote/new?${new URLSearchParams({
                        year,
                        make,
                        model,
                        trim,
                        modification,
                        wheelSku,
                        wheelName,
                        wheelUnit,
                        wheelQty,
                        wheelDia,
                        tireSku: safeSku,
                        tireName: title,
                        tireUnit: typeof displayPrice === "number" && Number.isFinite(displayPrice) ? String(displayPrice) : "",
                        tireQty: "4",
                      }).toString()}`
                    }
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:border-neutral-300"
                  >
                    Build quote
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
                  <span>Fitment verified before install</span>
                  <span className="text-neutral-300">•</span>
                  <span>Local install scheduling</span>
                  <span className="text-neutral-300">•</span>
                  <a href={BRAND.links.tel} className="font-extrabold text-neutral-900 hover:underline">
                    Prefer to talk? Call us
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-extrabold text-neutral-900">Specs</div>
              <div className="mt-2 grid gap-2 text-sm text-neutral-700">
                {t.tire_size ? <Spec k="Size" v={String(t.tire_size)} /> : null}
                {t.terrain ? <Spec k="Terrain" v={String(t.terrain)} /> : null}
                {t.construction_type ? <Spec k="Construction" v={String(t.construction_type)} /> : null}
                {t.mileage_warranty ? <Spec k="Warranty" v={`${String(t.mileage_warranty)} miles`} /> : null}
                {t.load_index ? <Spec k="Load index" v={String(t.load_index)} /> : null}
                {t.speed_rating ? <Spec k="Speed rating" v={String(t.speed_rating)} /> : null}
                {t.rim_diameter_in != null ? <Spec k="Wheel diameter" v={`${String(t.rim_diameter_in)} in`} /> : null}
                {t.section_width != null ? <Spec k="Section width" v={`${String(t.section_width)} mm`} /> : null}
                {t.series != null ? <Spec k="Aspect ratio" v={String(t.series)} /> : null}
              </div>
            </div>

            <div className="mt-4 text-xs text-neutral-600">Part / SKU: {safeSku}</div>
          </div>
        </div>

        {related.rows?.length ? (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-lg font-extrabold text-neutral-900">More options in this size</h2>
              <Link href="/tires" className="text-xs font-extrabold text-neutral-900 hover:underline">
                Browse all tires
              </Link>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.rows.slice(0, 8).map((r: any) => {
                const rp = priceFromRow(r);
                const name = String(r.tire_description || r.tire_size || r.simple_size || r.sku);
                return (
                  <Link
                    key={r.sku}
                    href={`/tires/${encodeURIComponent(String(r.sku))}`}
                    className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
                  >
                    <div className="text-[11px] font-semibold text-neutral-600">{String(r.brand_desc || "Tire")}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-extrabold text-neutral-900 group-hover:underline">
                      {name}
                    </div>

                    <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(r.image_url)}
                          alt={name}
                          className="h-28 w-full bg-white object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="p-3 text-xs text-neutral-700">Image coming soon</div>
                      )}
                    </div>

                    <div className="mt-3 text-lg font-extrabold text-neutral-900">
                      {rp != null ? fmtMoney(rp) : "Call for price"}
                    </div>
                    <div className="text-[11px] text-neutral-600">each</div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Mobile sticky CTA */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-1">
            <div>
              <div className="text-sm font-extrabold text-neutral-900">{displayPrice != null ? fmtMoney(displayPrice) : "Call for price"}</div>
              <div className="text-[11px] text-neutral-600">Per tire • Quote in minutes</div>
            </div>
            <a
              href="#quote"
              className="h-10 rounded-xl bg-[var(--brand-red)] px-4 py-2 text-center text-sm font-extrabold text-white"
            >
              Request quote
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div className="text-xs font-semibold text-neutral-600">{k}</div>
      <div className="text-xs font-extrabold text-neutral-900">{v}</div>
    </div>
  );
}
