import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool, getQuote, type QuoteLine } from "@/lib/quotes";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";

export const runtime = "nodejs";

function money(n: number) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "$0.00";
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function fetchWheelDetailsBySku(sku: string) {
  if (!sku) return null;
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/wheelpros/wheels/search?fields=images,properties,price&priceType=msrp&currencyCode=USD&page=1&pageSize=1&sku=${encodeURIComponent(
        sku
      )}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const it = (Array.isArray(data?.items) ? data.items[0] : Array.isArray(data?.results) ? data.results[0] : null) as any;
    const img = Array.isArray(it?.images) && it.images.length
      ? (it.images[0]?.imageUrlLarge || it.images[0]?.imageUrlMedium || it.images[0]?.imageUrlOriginal || it.images[0]?.imageUrlSmall)
      : null;

    const p = it?.properties || {};
    const specs: Array<{ k: string; v: string }> = [];
    if (p?.diameter) specs.push({ k: "Diameter", v: `${String(p.diameter)}\"` });
    if (p?.width) specs.push({ k: "Width", v: `${String(p.width)}\"` });
    if (p?.boltPatternMetric || p?.boltPattern) specs.push({ k: "Bolt pattern", v: String(p.boltPatternMetric || p.boltPattern) });
    if (p?.offset) specs.push({ k: "Offset", v: `${String(p.offset)} mm` });
    if (p?.finish) specs.push({ k: "Finish", v: String(p.finish) });

    return { imageUrl: img ? String(img) : undefined, specs };
  } catch {
    return null;
  }
}

async function fetchTireDetailsBySku(db: any, sku: string) {
  if (!sku) return null;
  try {
    const { rows } = await db.query({
      text: `
        select sku, tire_size, terrain, construction_type, mileage_warranty, load_index, speed_rating, image_url
        from wp_tires
        where sku = $1
        limit 1
      `,
      values: [sku],
    });
    const t = rows[0];
    if (!t) return null;

    const specs: Array<{ k: string; v: string }> = [];
    if (t.tire_size) specs.push({ k: "Size", v: String(t.tire_size) });
    if (t.terrain) specs.push({ k: "Terrain", v: String(t.terrain) });
    if (t.construction_type) specs.push({ k: "Construction", v: String(t.construction_type) });
    if (t.mileage_warranty) specs.push({ k: "Warranty", v: `${String(t.mileage_warranty)} miles` });
    if (t.load_index) specs.push({ k: "Load", v: String(t.load_index) });
    if (t.speed_rating) specs.push({ k: "Speed", v: String(t.speed_rating) });

    return { imageUrl: t.image_url ? String(t.image_url) : undefined, specs };
  } catch {
    return null;
  }
}

function ext(l: QuoteLine) {
  return (Number(l.unitPriceUsd) || 0) * (Number(l.qty) || 0);
}

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getPool();
  const q = await getQuote(db, String(id));

  if (!q) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Quote not found.</div>
          <div className="mt-4">
            <Link href="/" className="text-sm font-extrabold text-neutral-900 hover:underline">
              Back to shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const snap = q.snapshot;
  const v = snap.vehicle;
  // Never show raw engine text - extract clean submodel or omit
  const displayTrim = extractDisplayTrim(v?.trim ?? "");
  const vehicleLabel = [v?.year, v?.make, v?.model, displayTrim].filter(Boolean).join(" ");

  const wheelLine = (snap.lines || []).find((l) => (l as any)?.kind === "product" && (l as any)?.meta?.productType === "wheel") as QuoteLine | undefined;
  const tireLine = (snap.lines || []).find((l) => (l as any)?.kind === "product" && (l as any)?.meta?.productType === "tire") as QuoteLine | undefined;

  const svcLines = (snap.lines || []).filter((l) => (l as any)?.kind === "catalog") as QuoteLine[];
  const requiredSvc = svcLines.filter((l) => !!(l as any)?.meta?.required);
  const optionalSvc = svcLines.filter((l) => !(l as any)?.meta?.required);

  const [wheelDetails, tireDetails] = await Promise.all([
    wheelLine?.sku ? fetchWheelDetailsBySku(String(wheelLine.sku)) : Promise.resolve(null),
    tireLine?.sku ? fetchTireDetailsBySku(db, String(tireLine.sku)) : Promise.resolve(null),
  ]);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-600">{BRAND.name} quote</div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Quote #{q.id.slice(0, 8).toUpperCase()}</h1>
            <div className="mt-1 text-xs text-neutral-600">Saved {new Date(q.created_at).toLocaleString()}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900"
            >
              Print
            </button>
            <Link href="/" className="h-10 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-extrabold text-white">
              Shop
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Customer</div>
            <div className="mt-2 text-sm text-neutral-700">
              {snap.customer.firstName} {snap.customer.lastName}
            </div>
            <div className="mt-1 text-xs text-neutral-600">
              {snap.customer.email ? `Email: ${snap.customer.email}` : ""}
              {snap.customer.email && snap.customer.phone ? " • " : ""}
              {snap.customer.phone ? `Phone: ${snap.customer.phone}` : ""}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-xs font-extrabold text-neutral-900">SUMMARY</div>
            <div className="mt-1 text-sm font-extrabold text-neutral-900">{vehicleLabel || "Vehicle not specified"}</div>
          </div>

          {wheelLine ? (
            <ProductBlock
              title="WHEEL"
              name={wheelLine.name}
              sku={wheelLine.sku || ""}
              qty={wheelLine.qty}
              unit={Number(wheelLine.unitPriceUsd) || 0}
              total={ext(wheelLine)}
              imageUrl={wheelDetails?.imageUrl}
              specs={wheelDetails?.specs}
            />
          ) : null}

          {tireLine ? (
            <ProductBlock
              title="TIRE"
              name={tireLine.name}
              sku={tireLine.sku || ""}
              qty={tireLine.qty}
              unit={Number(tireLine.unitPriceUsd) || 0}
              total={ext(tireLine)}
              imageUrl={tireDetails?.imageUrl}
              specs={tireDetails?.specs}
            />
          ) : null}

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Required services</div>
            <div className="mt-3 grid gap-2">
              {requiredSvc.length ? requiredSvc.map((l, i) => (
                <LineRow key={i} name={l.name} price={money(ext(l))} />
              )) : <div className="text-sm text-neutral-700">—</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Optional services</div>
            <div className="mt-3 grid gap-2">
              {optionalSvc.length ? optionalSvc.map((l, i) => (
                <LineRow key={i} name={l.name} price={money(ext(l))} />
              )) : <div className="text-sm text-neutral-700">—</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Price summary</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Row k="Taxable parts" v={money(snap.totals.partsSubtotal)} />
              <Row k="Services" v={money(snap.totals.servicesSubtotal)} />
              <Row k={`Tax (${Math.round((snap.taxRate || 0) * 100)}%)`} v={money(snap.totals.tax)} />
              <div className="h-px bg-neutral-200" />
              <Row k="Total out the door" v={money(snap.totals.total)} strong />
            </div>
            <div className="mt-2 text-[11px] text-neutral-600">
              Total is an estimate. Well confirm fitment, availability and final invoice at installation.
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <div className="font-extrabold text-neutral-900">{BRAND.name}</div>
            <div className="mt-1">Call: {BRAND.phone.callDisplay} • Email: {BRAND.email}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProductBlock({
  title,
  name,
  sku,
  qty,
  unit,
  total,
  imageUrl,
  specs,
}: {
  title: string;
  name: string;
  sku: string;
  qty: number;
  unit: number;
  total: number;
  imageUrl?: string;
  specs?: Array<{ k: string; v: string }>;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-[140px_1fr_180px] md:items-start">
        <div className="rounded-xl border border-neutral-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
            alt={name}
            className={"h-[120px] w-full rounded-lg object-contain " + (imageUrl ? "bg-white" : "bg-neutral-50")}
          />
        </div>

        <div>
          <div className="text-xs font-extrabold text-neutral-900">{title}</div>
          <div className="mt-1 text-sm font-extrabold text-neutral-900">{name}</div>
          <div className="mt-1 text-[11px] text-neutral-600">SKU: {sku}</div>

          {specs?.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">
              <div className="divide-y divide-neutral-200">
                {specs.slice(0, 8).map((s) => (
                  <div key={s.k} className="grid grid-cols-[140px_1fr] gap-2 bg-white px-3 py-2 text-xs">
                    <div className="font-semibold text-neutral-600">{s.k}</div>
                    <div className="font-extrabold text-neutral-900">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-right">
          <div className="text-[11px] font-semibold text-neutral-600">QTY</div>
          <div className="text-sm font-extrabold text-neutral-900">{qty}</div>
          <div className="mt-2 text-[11px] font-semibold text-neutral-600">TOTAL</div>
          <div className="text-sm font-extrabold text-neutral-900">{money(total)}</div>
          <div className="mt-0.5 text-[11px] text-neutral-600">({money(unit)} × {qty})</div>
        </div>
      </div>
    </div>
  );
}

function LineRow({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="text-sm font-extrabold text-neutral-900">{name}</div>
      <div className="text-sm font-extrabold text-neutral-900">{price}</div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={strong ? "font-extrabold text-neutral-900" : "text-neutral-700"}>{k}</div>
      <div className={strong ? "font-extrabold text-neutral-900" : "font-semibold text-neutral-900"}>{v}</div>
    </div>
  );
}
