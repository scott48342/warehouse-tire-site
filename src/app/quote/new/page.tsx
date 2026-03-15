import Link from "next/link";
import { cookies } from "next/headers";
import { BRAND } from "@/lib/brand";
import { getPool as getQuotePool } from "@/lib/quotes";
import { listCatalogItems, getTaxRate } from "@/lib/quoteCatalog";
import { cookieName, verifyAdminToken } from "@/lib/adminAuth";
import { QuoteBuilder } from "@/components/QuoteBuilder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const debug = s(Array.isArray((sp as any).debug) ? (sp as any).debug[0] : (sp as any).debug) === "1";

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
  const taxRate = await getTaxRate(db);

  // Use a *loose* vehicle fitment lookup here (no trim) so we still get OEM tire sizes even
  // when the trim label doesn't match the upstream catalog perfectly.
  const fitmentStrict = year && make && model
    ? await fetchFitment({ year, make, model, modification: modification || undefined })
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
    const s = String(size || "").toUpperCase().trim();

    // Common formats:
    // - 265/65R18
    // - LT275/70R17
    // - 275/65-20
    // - 275/65/20
    let m = s.match(/R(\d{2})\b/);
    if (!m?.[1]) m = s.match(/[-/](\d{2})\b/);
    if (!m?.[1]) return null;

    const r = Number(m[1]);
    return Number.isFinite(r) ? r : null;
  }

  const wheelDiaN = parseWheelDia();
  const oemTireSizesFiltered = wheelDiaN
    ? oemTireSizesAll.filter((s) => rimFromTireSize(s) === wheelDiaN)
    : oemTireSizesAll;

  // If the strict filter yields nothing, fall back to the unfiltered list so customers can still proceed.
  const oemTireSizes = oemTireSizesFiltered.length ? oemTireSizesFiltered : oemTireSizesAll;

  const ck = await cookies();
  const adminToken = ck.get(cookieName())?.value;
  const isAdmin = await verifyAdminToken(adminToken);

  const wheelLine = wheelSku && wheelQty
    ? ({
        kind: "product",
        name: wheelName || wheelSku,
        sku: wheelSku,
        unitPriceUsd: Number(wheelUnit || 0),
        qty: wheelQty,
        taxable: true,
        meta: { productType: "wheel", wheelDia: wheelDia ? Number(wheelDia) : undefined },
      } as const)
    : undefined;

  const tireLine = tireSku && tireQty
    ? ({
        kind: "product",
        name: tireName || tireSku,
        sku: tireSku,
        unitPriceUsd: Number(tireUnit || 0),
        qty: tireQty,
        taxable: true,
        meta: { productType: "tire" },
      } as const)
    : undefined;

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
          <span className="ml-2 text-[11px] text-neutral-500">(build {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local"})</span>
        </div>

        <div className="mt-6">
          <QuoteBuilder
            vehicleLabel={[year, make, model, trim].filter(Boolean).join(" ")}
            vehicle={{ year, make, model, trim, modification }}
            wheel={wheelLine}
            tire={tireLine}
            catalog={catalog}
            oemTireSizes={oemTireSizes}
            taxRate={taxRate}
          />

          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            {BRAND.name} • {BRAND.phone.callDisplay} • {BRAND.email}
          </div>

          {debug && isAdmin ? (
            <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              <summary className="cursor-pointer font-extrabold">Debug: OEM tire sizes + wheel diameter filter</summary>
              <div className="mt-3 grid gap-2">
                <div>
                  <div className="font-extrabold">Detected wheel diameter</div>
                  <div className="mt-0.5">wheelDia param: {wheelDia || "(none)"}</div>
                  <div className="mt-0.5">parsed from wheelName: {wheelDiaN ? String(wheelDiaN) : "(none)"}</div>
                </div>

                <div>
                  <div className="font-extrabold">Vehicle query</div>
                  <pre className="mt-1 overflow-auto rounded-xl border border-amber-200 bg-white p-2">{JSON.stringify({ year, make, model, trim, modification }, null, 2)}</pre>
                </div>

                <div>
                  <div className="font-extrabold">Raw OEM tireSizes (from /api/vehicles/search)</div>
                  <pre className="mt-1 overflow-auto rounded-xl border border-amber-200 bg-white p-2">{JSON.stringify(oemTireSizesAll, null, 2)}</pre>
                </div>

                <div>
                  <div className="font-extrabold">After diameter filter</div>
                  <pre className="mt-1 overflow-auto rounded-xl border border-amber-200 bg-white p-2">{JSON.stringify(oemTireSizesFiltered, null, 2)}</pre>
                </div>

                <div>
                  <div className="font-extrabold">Fitment response (truncated)</div>
                  <pre className="mt-1 max-h-[240px] overflow-auto rounded-xl border border-amber-200 bg-white p-2">{JSON.stringify(fitmentStrict, null, 2)?.slice(0, 4000)}</pre>
                </div>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </main>
  );
}
