"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

export type WheelVariant = {
  sku: string;
  diameter?: string;
  width?: string;
  offset?: string;
  finish?: string;
};

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function WheelVariantSelector({
  variants,
  currentSku,
  selected,
}: {
  variants: WheelVariant[];
  currentSku: string;
  selected: { diameter?: string; width?: string; offset?: string; finish?: string };
}) {
  const router = useRouter();

  const options = useMemo(() => {
    const diameters = uniqSorted(variants.map((v) => v.diameter || ""));
    const widths = uniqSorted(variants.map((v) => v.width || ""));
    const offsets = uniqSorted(variants.map((v) => v.offset || ""));
    const finishes = uniqSorted(variants.map((v) => v.finish || ""));
    return { diameters, widths, offsets, finishes };
  }, [variants]);

  function pickSku(nextSel: { diameter?: string; width?: string; offset?: string; finish?: string }) {
    const exact = variants.find(
      (v) =>
        (!nextSel.diameter || v.diameter === nextSel.diameter) &&
        (!nextSel.width || v.width === nextSel.width) &&
        (!nextSel.offset || v.offset === nextSel.offset) &&
        (!nextSel.finish || v.finish === nextSel.finish)
    );
    if (exact?.sku) return exact.sku;

    // Fallback: keep finish + diameter, then anything
    const soft = variants.find(
      (v) =>
        (!nextSel.finish || v.finish === nextSel.finish) &&
        (!nextSel.diameter || v.diameter === nextSel.diameter)
    );
    return soft?.sku || currentSku;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Diameter</span>
          <select
            value={selected.diameter || ""}
            onChange={(e) => {
              const next = { ...selected, diameter: e.currentTarget.value || undefined };
              const sku = pickSku(next);
              router.push(`/wheels/${encodeURIComponent(sku)}`);
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.diameters.map((d) => (
              <option key={d} value={d}>
                {d}"
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Width</span>
          <select
            value={selected.width || ""}
            onChange={(e) => {
              const next = { ...selected, width: e.currentTarget.value || undefined };
              const sku = pickSku(next);
              router.push(`/wheels/${encodeURIComponent(sku)}`);
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.widths.map((w) => (
              <option key={w} value={w}>
                {w}"
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Offset</span>
          <select
            value={selected.offset || ""}
            onChange={(e) => {
              const next = { ...selected, offset: e.currentTarget.value || undefined };
              const sku = pickSku(next);
              router.push(`/wheels/${encodeURIComponent(sku)}`);
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.offsets.map((o) => (
              <option key={o} value={o}>
                {o}mm
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Finish</span>
          <select
            value={selected.finish || ""}
            onChange={(e) => {
              const next = { ...selected, finish: e.currentTarget.value || undefined };
              const sku = pickSku(next);
              router.push(`/wheels/${encodeURIComponent(sku)}`);
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.finishes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-xs text-neutral-600">
        Showing {variants.length} variants (best-effort grouping).
      </div>
    </div>
  );
}
