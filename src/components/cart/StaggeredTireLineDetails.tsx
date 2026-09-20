"use client";

import type { CartTireItem } from "@/lib/cart/CartContext";

/**
 * Shared staggered TIRE line details for cart page, cart slide-out and both checkout summaries
 * (2026-09-20, Codex hydrated CUA on aea23385: /checkout printed "245/35R19 • Qty: 4" for a
 * 19/20 set - rear axle, rear SKU and the 2 + 2 prices were invisible at payment).
 *
 * A staggered tire line is exactly 2 front + 2 rear; the quantity is fixed, each axle is shown
 * with its own size, SKU and price. Returns null for a square line so callers keep their own
 * square rendering.
 */
export function isStaggeredTireLine(t: CartTireItem): boolean {
  return Boolean(t.staggered && t.rearSku && t.rearSize);
}

export const STAGGERED_TIRE_QTY_COPY = "Set of 4 (2 front + 2 rear) - quantity fixed";

export function StaggeredTireLineDetails({ tire, compact = false }: { tire: CartTireItem; compact?: boolean }) {
  if (!isStaggeredTireLine(tire)) return null;
  const havePrices = tire.frontUnitPrice != null && tire.rearUnitPrice != null;
  return (
    <div className={`${compact ? "text-xs" : "text-sm"} text-neutral-600 space-y-0.5`} data-testid="tire-line-staggered">
      <p className="font-medium text-neutral-700">Staggered set · 2 front + 2 rear</p>
      <p>
        Front ×2: <span data-testid="tire-line-front-size">{tire.size}</span>
        {" · "}<span className="font-mono text-[0.9em]">{tire.sku}</span>
        {havePrices ? ` · $${tire.frontUnitPrice!.toFixed(2)} ea` : ""}
      </p>
      <p>
        Rear ×2: <span data-testid="tire-line-rear-size">{tire.rearSize}</span>
        {" · "}<span className="font-mono text-[0.9em]">{tire.rearSku}</span>
        {havePrices ? ` · $${tire.rearUnitPrice!.toFixed(2)} ea` : ""}
      </p>
      {havePrices ? (
        <p className="text-neutral-500" data-testid="tire-line-split-price">
          2 × ${tire.frontUnitPrice!.toFixed(2)} front + 2 × ${tire.rearUnitPrice!.toFixed(2)} rear
        </p>
      ) : null}
    </div>
  );
}
