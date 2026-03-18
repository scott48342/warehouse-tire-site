import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

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

  // Fetch all KM items for the size, then select the requested part number.
  // NOTE: We use minQty=1 for detail so the product still resolves even if stock is low.
  const res = await fetch(
    `${getBaseUrl()}/api/km/tiresizesearch?tireSize=${encodeURIComponent(size)}&minQty=1`,
    { cache: "no-store" }
  );

  const data = res.ok ? await res.json() : { error: await res.text() };
  const items: any[] = Array.isArray((data as any)?.items) ? (data as any).items : [];

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
  const description = String(item.description || "Tire");
  const cost = n(item.cost);
  const qPrimary = n(item?.quantity?.primary);
  const qAlt = n(item?.quantity?.alternate);
  const qNat = n(item?.quantity?.national);

  const title = `${brand} ${description}`;

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/tires?${backQs.toString()}`} className="text-sm font-extrabold text-neutral-900 hover:underline">
             Back to tires
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">{BRAND.name}</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900">{title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{size}</Badge>
              <Badge>Source: K&M</Badge>
              <Badge>Part: {safePart}</Badge>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-800">
              <div>
                <span className="font-semibold">Brand:</span> {brand}
              </div>
              <div>
                <span className="font-semibold">Description:</span> {description}
              </div>
              {cost != null ? (
                <div>
                  <span className="font-semibold">Cost:</span> {fmtMoney(cost)}
                </div>
              ) : null}
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">Availability (K&M)</div>
                <div className="mt-2 grid gap-1">
                  <div>Primary: {qPrimary ?? 0}</div>
                  <div>Alternate: {qAlt ?? 0}</div>
                  <div>National: {qNat ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-6">
            <div className="text-xs font-semibold text-neutral-600">Fitment</div>
            <div className="mt-2 text-sm font-extrabold text-neutral-900">
              {year && make && model ? `${year} ${make} ${model} ${trim}` : "Select a vehicle to verify fitment"}
            </div>
            <div className="mt-3 text-xs text-neutral-600">
              KM detail pages currently show supplier data; we can enrich this later with images, UTQG, etc.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
