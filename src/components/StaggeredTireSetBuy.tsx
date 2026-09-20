"use client";

import { AddTiresToCartButton } from "@/components/AddTiresToCartButton";
import { staggeredSetTotal, type StaggeredTireSet } from "@/lib/tires/staggeredPairContext";

const fmt = (n: number) => `$${n.toFixed(2)}`;

type Props = {
  sku: string;
  brand: string;
  model: string;
  size: string;
  frontUnitPrice: number | null;
  set: StaggeredTireSet;
  loadIndex?: string;
  speedRating?: string;
  imageUrl?: string;
  vehicle?: { year: string; make: string; model: string; trim?: string; modification?: string };
  source?: string;
  weightLbs?: number;
};

/**
 * Buy block for a tire PDP opened from a staggered pair (2026-09-20). Exactly 2 front +
 * 2 rear at each axle's own price; no quantity picker (the set is fixed at 4). When the
 * rear tire cannot be resolved or priced, nothing is sellable here - the shopper is told
 * to call, instead of getting 4 front tires.
 */
export function StaggeredTireSetBuy({ sku, brand, model, size, frontUnitPrice, set, loadIndex, speedRating, imageUrl, vehicle, source, weightLbs }: Props) {
  const canSell = !set.incomplete && set.sellable && frontUnitPrice != null && frontUnitPrice > 0;
  const total = canSell ? staggeredSetTotal(frontUnitPrice as number, set.rearUnitPrice as number) : null;
  const unavailableLabel = set.incomplete
    ? "Staggered set incomplete - reselect the pair from tire results"
    : set.rearResolved ? "Call to order staggered set" : "Rear tire unavailable - call to order";
  const unavailableTitle = set.incomplete ? "Pair details missing from this link" : set.rearResolved ? "Rear tire price unavailable" : "Rear tire could not be resolved";

  return (
    <div data-testid="staggered-tire-set-buy" className="mt-3 rounded-xl border border-neutral-200 bg-white/80 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Staggered set · 2 front + 2 rear</div>
      <div className="mt-2 flex items-center justify-between">
        <span>Front ×2 · <span className="font-semibold">{size}</span> <span className="font-mono text-xs text-neutral-400">{sku}</span></span>
        <span className="font-medium">{frontUnitPrice != null && frontUnitPrice > 0 ? `${fmt(frontUnitPrice)} ea` : "—"}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span>Rear ×2 · <span className="font-semibold">{set.rearSize}</span> <span className="font-mono text-xs text-neutral-400">{set.rearSku}</span></span>
        <span className="font-medium" data-testid="staggered-rear-price">{set.incomplete ? "not specified" : set.sellable ? `${fmt(set.rearUnitPrice as number)} ea` : set.rearResolved ? "price unavailable" : "not found"}</span>
      </div>
      {total != null ? (
        <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-base font-extrabold text-neutral-900">
          <span>Set total</span>
          <span data-testid="staggered-set-total">{fmt(total)}</span>
        </div>
      ) : null}

      <div className="mt-3">
        {canSell ? (
          <AddTiresToCartButton
            sku={sku}
            rearSku={set.rearSku}
            brand={brand}
            model={model}
            size={size}
            rearSize={set.rearSize}
            loadIndex={loadIndex}
            speedRating={speedRating}
            imageUrl={imageUrl}
            unitPrice={Math.round(((total as number) / 4) * 100) / 100}
            frontUnitPrice={frontUnitPrice as number}
            rearUnitPrice={set.rearUnitPrice as number}
            quantity={4}
            staggered
            vehicle={vehicle}
            source={source}
            weightLbs={weightLbs}
            variant="primary"
            className="w-full"
          />
        ) : (
          <button
            type="button"
            disabled
            data-testid="staggered-set-unavailable"
            className="w-full rounded-xl bg-neutral-300 py-3 text-sm font-bold text-neutral-500 cursor-not-allowed"
            title={unavailableTitle}
          >
            {unavailableLabel}
          </button>
        )}
      </div>
      <div className="mt-2 text-xs text-neutral-500">Front and rear sizes as selected · fit not yet confirmed - checked before shipping</div>
    </div>
  );
}
