import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool as getQuotePool, defaultLinesFromCatalog } from "@/lib/quotes";
import { listCatalogItems } from "@/lib/quoteCatalog";
import { AddTiresModal } from "@/components/AddTiresModal";

export const runtime = "nodejs";

function s(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function money(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

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

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};

  const year = s(Array.isArray((sp as any).year) ? (sp as any).year[0] : (sp as any).year);
  const make = s(Array.isArray((sp as any).make) ? (sp as any).make[0] : (sp as any).make);
  const model = s(Array.isArray((sp as any).model) ? (sp as any).model[0] : (sp as any).model);
  const trim = s(Array.isArray((sp as any).trim) ? (sp as any).trim[0] : (sp as any).trim);
  const modification = s(Array.isArray((sp as any).modification) ? (sp as any).modification[0] : (sp as any).modification);

  const wheelSku = s(Array.isArray((sp as any).wheelSku) ? (sp as any).wheelSku[0] : (sp as any).wheelSku);
  const wheelName = s(Array.isArray((sp as any).wheelName) ? (sp as any).wheelName[0] : (sp as any).wheelName);
  const wheelUnit = s(Array.isArray((sp as any).wheelUnit) ? (sp as any).wheelUnit[0] : (sp as any).wheelUnit);
  const wheelDia = s(Array.isArray((sp as any).wheelDia) ? (sp as any).wheelDia[0] : (sp as any).wheelDia);

  const tireSku = s(Array.isArray((sp as any).tireSku) ? (sp as any).tireSku[0] : (sp as any).tireSku);
  const tireName = s(Array.isArray((sp as any).tireName) ? (sp as any).tireName[0] : (sp as any).tireName);
  const tireUnit = s(Array.isArray((sp as any).tireUnit) ? (sp as any).tireUnit[0] : (sp as any).tireUnit);

  const wheelQty = Math.max(0, Math.min(6, Number(s((sp as any).wheelQty) || "4") || 0));
  const tireQty = Math.max(0, Math.min(6, Number(s((sp as any).tireQty) || "4") || 0));

  const db = getQuotePool();
  const catalog = await listCatalogItems(db);
  const defaultLines = defaultLinesFromCatalog(catalog, wheelQty, tireQty);

  const fitmentStrict = year && make && model
    ? await fetchFitment({ year, make, model, trim: trim || undefined, modification: modification || undefined })
    : null;

  const oemTireSizesAll: string[] = Array.isArray((fitmentStrict as any)?.tireSizes)
    ? (fitmentStrict as any).tireSizes.map(String)
    : [];

  function parseWheelDia(): number | null {
    // Prefer explicit param.
    const explicit = Number(wheelDia);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;

    // Fallback: try to read from wheel name like "AR901 20X9 ...".
    const m = String(wheelName || "").toUpperCase().match(/\b(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\b/);
    if (m?.[1]) {
      const d = Number(m[1]);
      if (Number.isFinite(d) && d > 0) return d;
    }
    return null;
  }

  function rimFromTireSize(size: string): number | null {
    // Matches common formats like 265/65R18 or LT275/70R17
    const m = String(size || "").toUpperCase().match(/R(\d{2})\b/);
    if (!m?.[1]) return null;
    const r = Number(m[1]);
    return Number.isFinite(r) ? r : null;
  }

  const wheelDiaN = parseWheelDia();
  const oemTireSizes = wheelDiaN
    ? oemTireSizesAll.filter((s) => rimFromTireSize(s) === wheelDiaN)
    : oemTireSizesAll;

  const lines = [
    ...(wheelSku && wheelQty
      ? [{ kind: "product", name: wheelName || wheelSku, sku: wheelSku, unitPriceUsd: Number(wheelUnit || 0), qty: wheelQty, taxable: true, meta: { productType: "wheel" } }]
      : []),
    ...(tireSku && tireQty
      ? [{ kind: "product", name: tireName || tireSku, sku: tireSku, unitPriceUsd: Number(tireUnit || 0), qty: tireQty, taxable: true, meta: { productType: "tire" } }]
      : []),
    ...defaultLines,
  ];

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-neutral-900">Build a quote</h1>
          <Link href="/" className="text-xs font-extrabold text-neutral-900 hover:underline">
            Back to shop
          </Link>
        </div>

        <div className="mt-2 text-sm text-neutral-700">
          Well verify fitment and confirm pricing before install.
        </div>

        <form action="/api/quotes/create" method="post" className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Customer</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                First name
                <input name="firstName" required className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Last name
                <input name="lastName" required className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Email
                <input name="email" type="email" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Phone
                <input name="phone" inputMode="tel" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
            </div>
            <div className="mt-2 text-[11px] text-neutral-600">Email or phone required.</div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Vehicle</div>
            <div className="mt-3 grid gap-2 md:grid-cols-5">
              <input type="hidden" name="modification" value={modification} />
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Year
                <input name="year" defaultValue={year} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Make
                <input name="make" defaultValue={make} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Model
                <input name="model" defaultValue={model} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Trim
                <input name="trim" defaultValue={trim} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <div className="text-xs text-neutral-600 md:col-span-1">&nbsp;</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Items</div>
            <div className="mt-3 grid gap-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_90px_120px] items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-extrabold text-neutral-900">{l.name}</div>
                    <div className="text-[11px] text-neutral-600">
                      {l.kind === "product"
                        ? `${(l.meta as any)?.productType || "product"}${l.sku ? ` • ${l.sku}` : ""}`
                        : (((l.meta as any)?.category as string | undefined) || l.kind)}
                      {l.taxable ? " • taxable" : ""}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-neutral-700">Qty {l.qty}</div>
                  <div className="text-xs font-extrabold text-neutral-900">${money(l.unitPriceUsd)}</div>
                </div>
              ))}
            </div>

            <input type="hidden" name="lines" value={JSON.stringify(lines)} />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-neutral-600">
                Tax is applied to taxable parts only.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {wheelSku ? (
                  <AddTiresModal
                    sizes={oemTireSizes}
                    baseParams={{
                      year,
                      make,
                      model,
                      trim,
                      modification,
                      wheelSku,
                      wheelName,
                      wheelUnit,
                      wheelQty: String(wheelQty || 4),
                    }}
                    disabledReason={year && make && model ? undefined : "Select a vehicle first"}
                  />
                ) : null}
                <button className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]">
                  Save quote
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            {BRAND.name} • {BRAND.phone.callDisplay} • {BRAND.email}
          </div>
        </form>
      </div>
    </main>
  );
}
