import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getDisplayTrim } from "@/lib/vehicleDisplay";
import { cleanTireDisplayTitle } from "@/lib/productFormat";
import { ImageGallery } from "@/components/ImageGallery";

export const runtime = "nodejs";

type TireAsset = {
  km_description?: string;
  display_name?: string;
  image_url?: string;
};

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function n(v: any): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-extrabold text-neutral-900">
      {children}
    </span>
  );
}

export default async function KmTireDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ partNumber: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partNumber } = await params;
  const sp = (await searchParams) || {};

  const safePart = String(partNumber || "").trim();
  const size = String((sp as any).size || "").trim();

  const year = String((sp as any).year || "");
  const make = String((sp as any).make || "");
  const model = String((sp as any).model || "");
  const trim = String((sp as any).trim || "");
  const modification = String((sp as any).modification || "");
  
  // Build display-friendly trim label (never shows engine text like "5.7i")
  const displayTrim = getDisplayTrim({ trim });

  const backQs = new URLSearchParams();
  if (year) backQs.set("year", year);
  if (make) backQs.set("make", make);
  if (model) backQs.set("model", model);
  if (trim) backQs.set("trim", trim);
  if (modification) backQs.set("modification", modification);
  if (size) backQs.set("size", size);

  if (!safePart) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Part number required.</div>
          <div className="mt-4">
            <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
               Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!size) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Missing tire size context for KM tire detail. (Need ?size=215/55R17)
          </div>
          <div className="mt-4">
            <Link href="/tires" className="text-sm font-extrabold text-neutral-900 hover:underline">
               Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Fetch from unified search API which includes admin image overrides
  // NOTE: We use minQty=1 for detail so the product still resolves even if stock is low.
  const res = await fetch(
    `${getBaseUrl()}/api/tires/search?size=${encodeURIComponent(size)}&minQty=1`,
    { cache: "no-store" }
  );

  const data = res.ok ? await res.json() : { error: await res.text() };
  const items: any[] = Array.isArray((data as any)?.results) ? (data as any).results : [];

  const item = items.find(
    (t) => String(t?.partNumber || "").trim() === safePart || String(t?.mfgPartNumber || "").trim() === safePart
  );

  if (!item) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            KM Tire not found (PartNumber: {safePart}, Size: {size}).
          </div>
          <div className="mt-4">
            <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
               Back to tires
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const brand = String(item.brand || "K&M");
  const descriptionRaw = String(item.description || "Tire");
  // Strip K&M's "/e" economy tier prefix from display
  const description = descriptionRaw.replace(/\s*\/e\s+/gi, " ").replace(/\s+/g, " ").trim();
  const cost = n(item.cost);
  const qPrimary = n(item?.quantity?.primary);
  const qAlt = n(item?.quantity?.alternate);
  const qNat = n(item?.quantity?.national);

  // Get image from unified API response (includes admin overrides)
  const enrichedImageUrl: string | null = item.imageUrl || null;
  const enrichedDisplayName: string | null = item.displayName || item.prettyName || null;

  // Clean display title: remove redundant brand (shown separately) and "/sl" load markers
  const rawTitle = enrichedDisplayName || `${brand} ${description}`;
  const title = cleanTireDisplayTitle(rawTitle, brand);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
             Back to tires
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          {/* Left column: Image + Product Details */}
          <div className="grid gap-4">
            <div className="rounded-3xl border border-neutral-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-neutral-600">Product photo</div>
                <div className="text-[11px] text-neutral-500">Click to zoom</div>
              </div>
              <ImageGallery images={enrichedImageUrl ? [enrichedImageUrl] : []} alt={title} note="Image may vary by size" />
            </div>

          </div>

          {/* Right column: Product info + CTA */}
          <div className="lg:sticky lg:top-6 rounded-3xl border border-neutral-200 bg-white p-6">
            {/* Fitment */}
            {year && make && model ? (
              <div className="mb-4 rounded-2xl bg-green-50 border border-green-200 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✓</span>
                  <div>
                    <div className="font-extrabold text-green-900">
                      Fits your {year} {make} {model}
                    </div>
                    <div className="mt-1 text-sm text-green-800">
                      Guaranteed fitment
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <div className="font-extrabold text-amber-900">Select your vehicle</div>
                    <div className="mt-1 text-sm text-amber-800">
                      We'll verify this tire fits before you buy
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs font-semibold text-neutral-600">{brand}</div>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">{title}</h1>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{size}</Badge>
            </div>

            {/* Price */}
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-neutral-900">
                {cost != null ? fmtMoney(cost + 50) : "Call for price"}
              </div>
              <div className="text-xs text-neutral-600">each</div>
            </div>

            {/* Stock status */}
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
              {(() => {
                const totalQty = (qPrimary ?? 0) + (qAlt ?? 0) + (qNat ?? 0);
                const inStock = totalQty >= 4;
                return (
                  <>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${inStock ? "bg-green-500" : "bg-amber-500"}`} />
                    <span className={inStock ? "text-green-800" : "text-amber-800"}>
                      {inStock ? "In stock" : "Available to order"}
                    </span>
                  </>
                );
              })()}
            </div>

            {/* CTA */}
            <div className="mt-5 grid gap-2">
              <a
                href={BRAND.links.tel}
                className="h-11 rounded-xl bg-[var(--brand-red)] px-4 py-3 text-center text-sm font-extrabold text-white"
              >
                Call for quote
              </a>
              <Link
                href="/schedule"
                className="h-11 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm font-extrabold text-neutral-900 hover:border-neutral-300"
              >
                Schedule install
              </Link>
            </div>

            <div className="mt-4 text-xs text-neutral-600">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-green-600">✓</span> Fitment verified before shipping
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-green-600">✓</span> Mount & balance included
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-green-600">✓</span> Expert support included
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
