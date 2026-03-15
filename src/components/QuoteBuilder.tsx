"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  meta?: Record<string, any>;
};

type QuoteLine = {
  kind: "product" | "catalog" | "custom";
  name: string;
  sku?: string;
  unitPriceUsd: number;
  qty: number;
  taxable: boolean;
  meta?: Record<string, any>;
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

export function QuoteBuilder({
  vehicleLabel,
  vehicle,
  wheel,
  tire,
  catalog,
  oemTireSizes,
  taxRate,
}: {
  vehicleLabel: string;
  vehicle: { year?: string; make?: string; model?: string; trim?: string; modification?: string };
  wheel?: ProductLine;
  tire?: ProductLine;
  catalog: CatalogItem[];
  oemTireSizes: string[];
  taxRate: number;
}) {
  const wheelQty = wheel?.qty || 0;
  const tireQty = tire?.qty || 0;

  const requiredItems = useMemo(
    () => catalog.filter((c) => c.active && c.required),
    [catalog]
  );
  const optionalItems = useMemo(
    () => catalog.filter((c) => c.active && !c.required),
    [catalog]
  );

  const [enabledOptional, setEnabledOptional] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const it of optionalItems) m[it.id] = !!it.default_checked;
    return m;
  });

  const lines: QuoteLine[] = useMemo(() => {
    const out: QuoteLine[] = [];
    if (wheel?.sku) out.push(wheel);
    if (tire?.sku) out.push(tire);

    for (const it of requiredItems) {
      const qty = qtyFor(it, wheelQty, tireQty);
      if (!qty) continue;
      out.push({
        kind: "catalog",
        name: it.name,
        unitPriceUsd: Number(it.unit_price_usd),
        qty,
        taxable: !!it.taxable,
        meta: { catalogId: it.id, category: it.category, required: true, appliesTo: it.applies_to },
      });
    }

    for (const it of optionalItems) {
      if (!enabledOptional[it.id]) continue;
      const qty = qtyFor(it, wheelQty, tireQty);
      if (!qty) continue;
      out.push({
        kind: "catalog",
        name: it.name,
        unitPriceUsd: Number(it.unit_price_usd),
        qty,
        taxable: !!it.taxable,
        meta: { catalogId: it.id, category: it.category, required: false, appliesTo: it.applies_to },
      });
    }

    return out;
  }, [wheel, tire, requiredItems, optionalItems, enabledOptional, wheelQty, tireQty]);

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
          total={ext(wheel)}
          changeHref={`/wheels?${new URLSearchParams(vehicle as any).toString()}`}
        />
      ) : null}

      {tire ? (
        <ProductCard
          title="TIRE"
          name={tire.name}
          sku={tire.sku}
          qty={tire.qty}
          total={ext(tire)}
          changeHref={`/tires?${new URLSearchParams(vehicle as any).toString()}`}
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

      <div className="grid gap-2 md:grid-cols-2">
        <SaveQuoteModal linesJson={JSON.stringify(lines)} vehicle={vehicle} />
        <Link
          href="/schedule"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-extrabold text-white"
        >
          Schedule install
        </Link>
      </div>
    </div>
  );
}

function ProductCard({
  title,
  name,
  sku,
  qty,
  total,
  changeHref,
}: {
  title: string;
  name: string;
  sku: string;
  qty: number;
  total: number;
  changeHref: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold text-neutral-900">{title}</div>
          <div className="mt-1 text-sm font-extrabold text-neutral-900">{name}</div>
          <div className="mt-1 text-[11px] text-neutral-600">SKU: {sku}</div>
          <div className="mt-3">
            <Link href={changeHref} className="text-xs font-extrabold text-blue-700 hover:underline">
              Change {title.toLowerCase()}
            </Link>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-right">
          <div className="text-[11px] font-semibold text-neutral-600">QTY</div>
          <div className="text-sm font-extrabold text-neutral-900">{qty}</div>
          <div className="mt-2 text-[11px] font-semibold text-neutral-600">TOTAL</div>
          <div className="text-sm font-extrabold text-neutral-900">{money(total)}</div>
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
