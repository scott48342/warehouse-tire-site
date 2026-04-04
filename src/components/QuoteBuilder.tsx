"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/quoteCatalog";
import { AddTiresModal } from "@/components/AddTiresModal";
import { SaveQuoteModal } from "@/components/SaveQuoteModal";

export type ProductLine = {
  kind: "product";
  name: string;
  sku: string;
  unitPriceUsd: number;
  qty: number;
  taxable: boolean;
  meta?: Record<string, unknown>;
};

export type ProductDetails = {
  imageUrl?: string;
  specs?: Array<{ k: string; v: string }>;
};

type QuoteLine = {
  kind: "product" | "catalog" | "custom";
  name: string;
  sku?: string;
  unitPriceUsd: number;
  qty: number;
  taxable: boolean;
  meta?: Record<string, unknown>;
};

function money(n: number) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "$0.00";
}

function ext(l: { unitPriceUsd: number; qty: number }) {
  return (Number(l.unitPriceUsd) || 0) * (Number(l.qty) || 0);
}

function computeTotals(lines: QuoteLine[], taxRate: number) {
  let taxableSubtotal = 0;
  let servicesSubtotal = 0;

  for (const l of lines) {
    const e = ext(l);
    if (l.taxable) taxableSubtotal += e;
    else servicesSubtotal += e;
  }

  const partsSubtotal = round2(taxableSubtotal);
  const services = round2(servicesSubtotal);
  const tax = round2(partsSubtotal * (Number(taxRate) || 0));
  const total = round2(partsSubtotal + services + tax);

  return { partsSubtotal, servicesSubtotal: services, tax, total };
}

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function qtyFor(item: CatalogItem, wheelQty: number, tireQty: number) {
  if (item.applies_to === "wheel") return wheelQty;
  if (item.applies_to === "tire") return tireQty;
  return 1;
}

function unitPriceForContext(item: CatalogItem, ctx: "tire" | "wheel" | "package") {
  const legacy = Number(item.unit_price_usd);

  const tire = item.unit_price_tire_usd != null ? Number(item.unit_price_tire_usd) : null;
  const wheel = item.unit_price_wheel_usd != null ? Number(item.unit_price_wheel_usd) : null;
  const pack = item.unit_price_package_usd != null ? Number(item.unit_price_package_usd) : null;

  if (ctx === "package") return pack ?? tire ?? wheel ?? (Number.isFinite(legacy) ? legacy : 0);
  if (ctx === "wheel") return wheel ?? tire ?? pack ?? (Number.isFinite(legacy) ? legacy : 0);
  return tire ?? wheel ?? pack ?? (Number.isFinite(legacy) ? legacy : 0);
}

function appliesInContext(item: CatalogItem, hasWheel: boolean, hasTire: boolean) {
  if (hasWheel && hasTire) return item.applies_package !== false;
  if (hasWheel) return item.applies_wheel !== false;
  if (hasTire) return item.applies_tire !== false;
  return false;
}

export function QuoteBuilder({
  vehicleLabel,
  vehicle,
  wheel,
  tire,
  catalog,
  oemTireSizes,
  taxRate,
  wheelChangeHref,
  wheelRemoveHref,
  tireChangeHref,
  tireRemoveHref,
  wheelDetails,
  tireDetails,
}: {
  vehicleLabel: string;
  vehicle: { year?: string; make?: string; model?: string; trim?: string; modification?: string };
  wheel?: ProductLine;
  tire?: ProductLine;
  catalog: CatalogItem[];
  oemTireSizes: string[];
  taxRate: number;
  wheelChangeHref?: string;
  wheelRemoveHref?: string;
  tireChangeHref?: string;
  tireRemoveHref?: string;
  wheelDetails?: ProductDetails;
  tireDetails?: ProductDetails;
}) {
  const wheelQty = wheel?.qty || 0;
  const tireQty = tire?.qty || 0;
  const hasWheel = !!wheel?.sku;
  const hasTire = !!tire?.sku;
  const ctx: "tire" | "wheel" | "package" = hasWheel && hasTire ? "package" : hasWheel ? "wheel" : "tire";

  const requiredItems = useMemo(
    () => catalog.filter((c) => c.active && c.required && appliesInContext(c, hasWheel, hasTire)),
    [catalog, hasWheel, hasTire]
  );
  const optionalItems = useMemo(
    () => catalog.filter((c) => c.active && !c.required && appliesInContext(c, hasWheel, hasTire)),
    [catalog, hasWheel, hasTire]
  );

  const [enabledOptional, setEnabledOptional] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const it of optionalItems) m[it.id] = !!it.default_checked;
    return m;
  });

  const [tpmsOn, setTpmsOn] = useState(false);
  const [tpmsPartNumber, setTpmsPartNumber] = useState("");
  const [tpmsUnit, setTpmsUnit] = useState<number | null>(null);
  const [tpmsLoading, setTpmsLoading] = useState(false);
  const [tpmsError, setTpmsError] = useState<string | null>(null);

  const tpmsQty = hasWheel ? wheelQty : 0;

  async function lookupTpmsPrice(partNumberRaw: string) {
    const pn = String(partNumberRaw || "").trim();
    if (!pn) {
      setTpmsUnit(null);
      setTpmsError("Enter a TPMS part number.");
      return;
    }

    setTpmsLoading(true);
    setTpmsError(null);

    try {
      const res = await fetch(`/api/km/partlookup?partNumber=${encodeURIComponent(pn)}`, { cache: "no-store" });
      const json = (await res.json()) as unknown;
      const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;

      if (!res.ok) {
        const msg = obj && typeof obj.error === "string" ? obj.error : `TPMS lookup failed (${res.status}).`;
        setTpmsError(msg);
        setTpmsUnit(null);
        return;
      }

      const itemsRaw = obj && Array.isArray(obj.items) ? (obj.items as unknown[]) : [];
      const first = itemsRaw[0] && typeof itemsRaw[0] === "object" ? (itemsRaw[0] as Record<string, unknown>) : null;
      const price = first && typeof first.price === "number" ? (first.price as number) : null;
      if (price == null) {
        setTpmsError("TPMS price not available for that part.");
        setTpmsUnit(null);
        return;
      }

      setTpmsUnit(price);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTpmsError(msg);
      setTpmsUnit(null);
    } finally {
      setTpmsLoading(false);
    }
  }

  // If TPMS is turned off, clear state so we don't accidentally save it.
  useEffect(() => {
    if (!tpmsOn) {
      setTpmsUnit(null);
      setTpmsError(null);
    }
  }, [tpmsOn]);

  const lines: QuoteLine[] = useMemo(() => {
    const out: QuoteLine[] = [];
    if (wheel?.sku) out.push(wheel);
    if (tire?.sku) out.push(tire);

    if (tpmsOn && hasWheel && tpmsQty > 0 && typeof tpmsUnit === "number") {
      out.push({
        kind: "custom",
        name: `TPMS Sensor${tpmsPartNumber.trim() ? ` (${tpmsPartNumber.trim()})` : ""}`,
        sku: tpmsPartNumber.trim() || undefined,
        unitPriceUsd: tpmsUnit,
        qty: tpmsQty,
        taxable: true,
        meta: { type: "tpms", source: "km", partNumber: tpmsPartNumber.trim() || undefined },
      });
    }

    for (const it of requiredItems) {
      const qty = qtyFor(it, wheelQty, tireQty);
      if (!qty) continue;
      out.push({
        kind: "catalog",
        name: it.name,
        unitPriceUsd: unitPriceForContext(it, ctx),
        qty,
        taxable: !!it.taxable,
        meta: { catalogId: it.id, category: it.category, required: true, appliesTo: it.applies_to, ctx },
      });
    }

    for (const it of optionalItems) {
      if (!enabledOptional[it.id]) continue;
      const qty = qtyFor(it, wheelQty, tireQty);
      if (!qty) continue;
      out.push({
        kind: "catalog",
        name: it.name,
        unitPriceUsd: unitPriceForContext(it, ctx),
        qty,
        taxable: !!it.taxable,
        meta: { catalogId: it.id, category: it.category, required: false, appliesTo: it.applies_to, ctx },
      });
    }

    return out;
  }, [wheel, tire, requiredItems, optionalItems, enabledOptional, wheelQty, tireQty, tpmsOn, tpmsUnit, tpmsPartNumber, hasWheel, tpmsQty]);

  const totals = useMemo(() => computeTotals(lines, taxRate), [lines, taxRate]);

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-xs font-extrabold text-neutral-900">SUMMARY</div>
        <div className="mt-1 text-sm font-extrabold text-neutral-900">
          {vehicleLabel || "Select a vehicle"}
        </div>
      </div>

      {wheel ? (
        <ProductCard
          title="WHEEL"
          name={wheel.name}
          sku={wheel.sku}
          qty={wheel.qty}
          unit={wheel.unitPriceUsd}
          total={ext(wheel)}
          changeHref={wheelChangeHref || `/wheels?${new URLSearchParams(vehicle as any).toString()}`}
          removeHref={wheelRemoveHref}
          details={wheelDetails}
        />
      ) : null}

      {tire ? (
        <ProductCard
          title="TIRE"
          name={tire.name}
          sku={tire.sku}
          qty={tire.qty}
          unit={tire.unitPriceUsd}
          total={ext(tire)}
          changeHref={tireChangeHref || `/tires?${new URLSearchParams(vehicle as any).toString()}`}
          removeHref={tireRemoveHref}
          details={tireDetails}
        />
      ) : null}

      {wheel ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-neutral-900">Add tires</div>
              <div className="mt-1 text-xs text-neutral-600">Pick an OEM size (we’ll confirm fitment).</div>
            </div>
            <AddTiresModal
              sizes={oemTireSizes}
              baseParams={{
                ...(vehicle as any),
                wheelSku: wheel.sku,
                wheelName: wheel.name,
                wheelUnit: String(wheel.unitPriceUsd),
                wheelQty: String(wheel.qty),
                wheelDia: String(wheel.meta?.wheelDia || ""),
              }}
              disabledReason={vehicle.year && vehicle.make && vehicle.model ? undefined : "Select a vehicle first"}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-extrabold text-neutral-900">Required services</div>
        <div className="mt-3 grid gap-2">
          {requiredItems.length ? (
            requiredItems.map((it) => (
              <ServiceRow key={it.id} name={it.name} price={Number(it.unit_price_usd) * qtyFor(it, wheelQty, tireQty)} />
            ))
          ) : (
            <div className="text-sm text-neutral-700">None configured yet.</div>
          )}
        </div>
      </div>

      {hasWheel ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-sm font-extrabold text-neutral-900">TPMS sensors</div>
          <div className="mt-1 text-xs text-neutral-600">
            Optional add-on. Enter a part number (e.g. HTS-A78ED) and we’ll include {tpmsQty || 4} sensor(s) on the quote.
          </div>

          <div className="mt-3 grid gap-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
              <div>
                <div className="text-sm font-extrabold text-neutral-900">Include TPMS sensors</div>
                <div className="mt-0.5 text-[11px] text-neutral-600">
                  {tpmsOn
                    ? tpmsLoading
                      ? "Looking up price…"
                      : tpmsError
                        ? tpmsError
                        : typeof tpmsUnit === "number"
                          ? `${money(tpmsUnit)} each × ${tpmsQty || 4}`
                          : "Enter a part number and click Lookup"
                    : "Off"}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-900">
                <input type="checkbox" checked={tpmsOn} onChange={(e) => setTpmsOn(e.target.checked)} />
                {tpmsOn ? "ON" : "OFF"}
              </div>
            </label>

            {tpmsOn ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <input
                  value={tpmsPartNumber}
                  onChange={(e) => setTpmsPartNumber(e.target.value)}
                  placeholder="TPMS part number"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900"
                />
                <button
                  type="button"
                  onClick={() => lookupTpmsPrice(tpmsPartNumber)}
                  disabled={tpmsLoading}
                  className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  {tpmsLoading ? "Looking…" : "Lookup"}
                </button>
              </div>
            ) : null}

            <div className="text-[11px] text-neutral-500">
              Tip: You can search TPMS parts here: <Link className="font-semibold text-blue-700 hover:underline" href="/accessories/tpms">TPMS lookup</Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-extrabold text-neutral-900">Optional services</div>
        <div className="mt-3 grid gap-2">
          {optionalItems.length ? (
            optionalItems.map((it) => {
              const enabled = !!enabledOptional[it.id];
              const price = Number(it.unit_price_usd) * qtyFor(it, wheelQty, tireQty);
              return (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-extrabold text-neutral-900">{it.name}</div>
                    <div className="mt-0.5 text-[11px] text-neutral-600">{it.applies_to} • {money(price)}</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-extrabold text-neutral-900">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabledOptional((m) => ({ ...m, [it.id]: e.target.checked }))}
                    />
                    {enabled ? "ON" : "OFF"}
                  </label>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-neutral-700">None configured yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-extrabold text-neutral-900">Price summary</div>
        <div className="mt-3 grid gap-2 text-sm">
          <Row k="Subtotal" v={money(totals.partsSubtotal + totals.servicesSubtotal)} />
          <Row k={`Tax (${Math.round((Number(taxRate) || 0) * 100)}%)`} v={money(totals.tax)} />
          <div className="h-px bg-neutral-200" />
          <Row k="Total price" v={money(totals.total)} strong />
        </div>
      </div>

      <div className="flex justify-center">
        <SaveQuoteModal linesJson={JSON.stringify(lines)} vehicle={vehicle} />
      </div>
    </div>
  );
}

function ProductCard({
  title,
  name,
  sku,
  qty,
  unit,
  total,
  changeHref,
  removeHref,
  details,
}: {
  title: string;
  name: string;
  sku: string;
  qty: number;
  unit: number;
  total: number;
  changeHref: string;
  removeHref?: string;
  details?: ProductDetails;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="grid gap-4 md:grid-cols-[140px_1fr_180px] md:items-start">
        <div className="rounded-xl border border-neutral-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={details?.imageUrl || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
            alt={name}
            className={"h-[120px] w-full rounded-lg object-contain " + (details?.imageUrl ? "bg-white" : "bg-neutral-50")}
          />
        </div>

        <div>
          <div className="text-xs font-extrabold text-neutral-900">{title}</div>
          <div className="mt-1 text-sm font-extrabold text-neutral-900">{name}</div>
          <div className="mt-1 text-[11px] text-neutral-600">SKU: {sku}</div>

          {details?.specs?.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">
              <div className="divide-y divide-neutral-200">
                {details.specs.slice(0, 8).map((s) => (
                  <div key={s.k} className="grid grid-cols-[140px_1fr] gap-2 bg-white px-3 py-2 text-xs">
                    <div className="font-semibold text-neutral-600">{s.k}</div>
                    <div className="font-extrabold text-neutral-900">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={changeHref} className="text-xs font-extrabold text-blue-700 hover:underline">
              Change {title.toLowerCase()}
            </Link>
            {removeHref ? (
              <Link href={removeHref} className="text-xs font-extrabold text-red-700 hover:underline">
                Remove {title.toLowerCase()}
              </Link>
            ) : null}
          </div>
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

function ServiceRow({ name, price }: { name: string; price: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="text-sm font-extrabold text-neutral-900">{name}</div>
      <div className="text-sm font-extrabold text-neutral-900">{money(price)}</div>
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
