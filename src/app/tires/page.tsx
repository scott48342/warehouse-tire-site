import Link from "next/link";
import { BRAND } from "@/lib/brand";

type Tire = {
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  description?: string;
  cost?: number;
  quantity?: { primary?: number; alternate?: number; national?: number };
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchFitment(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }

  const res = await fetch(`${getBaseUrl()}/api/vehicles/search?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

async function fetchKmTires(tireSize: string) {
  const res = await fetch(`${getBaseUrl()}/api/km/tiresizesearch?tireSize=${encodeURIComponent(tireSize)}&minQty=4`, {
    cache: "no-store",
  });
  if (!res.ok) return { error: await res.text() };
  return res.json();
}

export default async function TiresPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const zipRaw = Array.isArray(sp.zip) ? sp.zip[0] : sp.zip;
  const zip = (zipRaw ?? "").trim();

  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";
  const trim = (Array.isArray(sp.trim) ? sp.trim[0] : sp.trim) || "";
  const modification = (Array.isArray(sp.modification) ? sp.modification[0] : sp.modification) || "";

  const fitment = year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
    : null;

  const tireSizes: string[] = Array.isArray(fitment?.tireSizes) ? fitment.tireSizes.map(String) : [];

  const selectedSizeRaw = (Array.isArray(sp.size) ? sp.size[0] : sp.size) || "";
  const selectedSize = selectedSizeRaw ? String(selectedSizeRaw) : (tireSizes[0] || "");

  const km = selectedSize ? await fetchKmTires(selectedSize) : null;
  const items: Tire[] = Array.isArray(km?.items) ? km.items : [];

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Tires
            </h1>
            <p className="mt-1 text-sm text-neutral-700">
              {year && make && model
                ? `Showing tires for ${year} ${make} ${model}${trim ? ` ${trim}` : ""}.`
                : "Select your vehicle in the header to filter tires."}
            </p>
            {tireSizes.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {tireSizes.map((s) => {
                  const active = s === selectedSize;
                  const href = `/tires?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}${trim ? `&trim=${encodeURIComponent(trim)}` : ""}${modification ? `&modification=${encodeURIComponent(modification)}` : ""}&size=${encodeURIComponent(s)}`;
                  return (
                    <Link
                      key={s}
                      href={href}
                      className={
                        active
                          ? "rounded-full bg-neutral-900 px-3 py-1 text-xs font-extrabold text-white"
                          : "rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900"
                      }
                    >
                      {s}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form className="flex items-center gap-2" action="/tires" method="get">
              <label className="text-xs font-semibold text-neutral-600">ZIP</label>
              <input
                name="zip"
                defaultValue={zip}
                placeholder="48342"
                className="h-10 w-28 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
              />
              <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">
                Update
              </button>
            </form>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-neutral-600">Sort</label>
              <select className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold">
                <option>Best Match</option>
                <option>Price Low to High</option>
                <option>Price High to Low</option>
                <option>Highest Rated</option>
                <option>Most Popular</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[280px_1fr]">
          <aside className="sticky top-24 hidden h-fit rounded-2xl border border-neutral-200 bg-white p-4 md:block">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Filters</h2>
              <button className="text-xs font-semibold text-neutral-600 hover:underline">
                Clear all
              </button>
            </div>

            <FilterGroup title="Vehicle / Size">
              <div className="grid gap-2">
                <form className="grid gap-2" action="/tires" method="get">
                  <input type="hidden" name="year" value={year} />
                  <input type="hidden" name="make" value={make} />
                  <input type="hidden" name="model" value={model} />
                  <input type="hidden" name="trim" value={trim} />
                  <input type="hidden" name="modification" value={modification} />

                  <input
                    name="size"
                    defaultValue={selectedSize}
                    placeholder="Search by size (e.g. 245/50R18)"
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  />
                  <button className="h-10 rounded-xl bg-neutral-900 text-sm font-extrabold text-white">
                    Search size
                  </button>
                </form>
              </div>
            </FilterGroup>

            <FilterGroup title="Brand">
              <Check label="Michelin" />
              <Check label="Goodyear" />
              <Check label="Bridgestone" />
              <Check label="Continental" />
              <Check label="Pirelli" />
              <Check label="Budget" />
            </FilterGroup>

            <FilterGroup title="Price">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="$ min"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  placeholder="$ max"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </div>
            </FilterGroup>

            <FilterGroup title="Tire Size">
              <div className="grid grid-cols-3 gap-2">
                <select className="h-10 rounded-xl border border-neutral-200 bg-white px-2 text-sm">
                  <option>Width</option>
                  <option>205</option>
                  <option>215</option>
                  <option>225</option>
                  <option>235</option>
                  <option>245</option>
                </select>
                <select className="h-10 rounded-xl border border-neutral-200 bg-white px-2 text-sm">
                  <option>Aspect</option>
                  <option>45</option>
                  <option>50</option>
                  <option>55</option>
                  <option>60</option>
                  <option>65</option>
                </select>
                <select className="h-10 rounded-xl border border-neutral-200 bg-white px-2 text-sm">
                  <option>Diameter</option>
                  <option>16</option>
                  <option>17</option>
                  <option>18</option>
                  <option>20</option>
                  <option>22</option>
                </select>
              </div>
            </FilterGroup>

            <FilterGroup title="Season">
              <Check label="All-season" />
              <Check label="All-terrain" />
              <Check label="Winter" />
              <Check label="Summer" />
            </FilterGroup>

            <FilterGroup title="Mileage Warranty">
              <Check label="40,000+" />
              <Check label="60,000+" />
              <Check label="80,000+" />
            </FilterGroup>

            <FilterGroup title="Speed Rating">
              <Check label="S" />
              <Check label="T" />
              <Check label="H" />
              <Check label="V" />
              <Check label="W" />
            </FilterGroup>

            <FilterGroup title="Load Range">
              <Check label="SL" />
              <Check label="XL" />
              <Check label="C" />
              <Check label="D" />
              <Check label="E" />
            </FilterGroup>

            <FilterGroup title="Run Flat">
              <Check label="Run-flat" />
            </FilterGroup>

            <FilterGroup title="Snow Rated / All Weather">
              <Check label="3PMSF (Snow rated)" />
              <Check label="All Weather" />
            </FilterGroup>

            <FilterGroup title="UTQG Rating">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Treadwear min"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
                <input
                  placeholder="Treadwear max"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </div>
            </FilterGroup>

            <FilterGroup title="Rebates / Specials">
              <Check label="Rebate available" />
              <Check label="Specials" />
            </FilterGroup>

            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-neutral-800">
              <div className="font-extrabold">Tip</div>
              <div className="mt-1">
                Best conversions come from showing local availability and an easy
                schedule flow.
              </div>
            </div>
          </aside>

          <section className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Chip>All-season</Chip>
              <Chip>225/65R17</Chip>
              <Chip>{zip ? `In stock near ${zip}` : "In stock near you"}</Chip>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {km?.error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  Tire search error: {String(km.error).slice(0, 500)}
                </div>
              ) : null}

              {items.length ? (
                items.map((t, idx) => (
                  <article
                    key={t.partNumber || t.mfgPartNumber || idx}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
                  >
                    <div className="text-xs font-semibold text-neutral-600">
                      {t.brand || "Tire"}
                    </div>
                    <h3 className="mt-0.5 text-sm font-extrabold text-neutral-900">
                      {t.description || t.partNumber || "Tire"}
                    </h3>

                    <div className="mt-4">
                      <div className="text-3xl font-extrabold text-neutral-900">
                        {typeof t.cost === "number" ? `$${(t.cost + 50).toFixed(2)}` : "Call for price"}
                      </div>
                      <div className="text-xs text-neutral-600">each</div>
                    </div>

                    <div className="mt-3 text-xs text-neutral-700">
                      Qty: {t.quantity?.primary ?? 0} primary • {t.quantity?.alternate ?? 0} alt • {t.quantity?.national ?? 0} nat
                    </div>

                    <div className="mt-4 grid gap-2">
                      <Link
                        href="/schedule"
                        className="rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-extrabold text-white"
                      >
                        Schedule Install
                      </Link>

                      <div className="flex items-center justify-between gap-3 text-xs">
                        <a
                          href={BRAND.links.tel}
                          className="font-extrabold text-neutral-900 hover:underline"
                        >
                          Call
                        </a>
                        <a
                          href={BRAND.links.sms}
                          className="font-extrabold text-neutral-900 hover:underline"
                        >
                          Text
                        </a>
                        <a
                          href={BRAND.links.whatsapp}
                          className="font-extrabold text-neutral-900 hover:underline"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
                  {year && make && model ? (
                    tireSizes.length
                      ? "No tire results yet."
                      : "No OEM tire size returned for this vehicle/trim yet."
                  ) : (
                    "Select a vehicle in the header to see tires."
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
              Next: wire supplier feed + real filters + “in stock near you” logic.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800">
      {children}
    </span>
  );
}

// Badge removed (placeholder UI no longer uses it)

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-extrabold text-neutral-900">{title}</div>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}

function Check({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-800">
      <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
