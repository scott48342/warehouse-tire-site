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

    const byDiameter = selected.diameter
      ? variants.filter((v) => v.diameter === selected.diameter)
      : variants;

    const widths = uniqSorted(byDiameter.map((v) => v.width || ""));

    const byDiameterWidth = selected.width
      ? byDiameter.filter((v) => v.width === selected.width)
      : byDiameter;

    const offsets = uniqSorted(byDiameterWidth.map((v) => v.offset || ""));

    const byDiameterWidthOffset = selected.offset
      ? byDiameterWidth.filter((v) => v.offset === selected.offset)
      : byDiameterWidth;

    const finishes = uniqSorted(byDiameterWidthOffset.map((v) => v.finish || ""));

    return { diameters, widths, offsets, finishes };
  }, [variants, selected.diameter, selected.width, selected.offset]);

  function pickSku(nextSel: { diameter?: string; width?: string; offset?: string; finish?: string }) {
    const exact = variants.find(
      (v) =>
        (!nextSel.diameter || v.diameter === nextSel.diameter) &&
        (!nextSel.width || v.width === nextSel.width) &&
        (!nextSel.offset || v.offset === nextSel.offset) &&
        (!nextSel.finish || v.finish === nextSel.finish)
    );
    if (exact?.sku) return exact.sku;

    // Fallback: try to keep the most specific filters first
    const soft = variants.find(
      (v) =>
        (!nextSel.diameter || v.diameter === nextSel.diameter) &&
        (!nextSel.width || v.width === nextSel.width) &&
        (!nextSel.offset || v.offset === nextSel.offset)
    );
    return soft?.sku || currentSku;
  }

  function coerce(nextSel: { diameter?: string; width?: string; offset?: string; finish?: string }) {
    // If a dependent selection no longer exists under the current constraints, clear it.
    const byDiameter = nextSel.diameter ? variants.filter((v) => v.diameter === nextSel.diameter) : variants;
    const widths = uniqSorted(byDiameter.map((v) => v.width || ""));
    if (nextSel.width && !widths.includes(nextSel.width)) nextSel.width = undefined;

    const byDiameterWidth = nextSel.width ? byDiameter.filter((v) => v.width === nextSel.width) : byDiameter;
    const offsets = uniqSorted(byDiameterWidth.map((v) => v.offset || ""));
    if (nextSel.offset && !offsets.includes(nextSel.offset)) nextSel.offset = undefined;

    const byDiameterWidthOffset = nextSel.offset
      ? byDiameterWidth.filter((v) => v.offset === nextSel.offset)
      : byDiameterWidth;
    const finishes = uniqSorted(byDiameterWidthOffset.map((v) => v.finish || ""));
    if (nextSel.finish && !finishes.includes(nextSel.finish)) nextSel.finish = undefined;

    return nextSel;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Diameter</span>
          <select
            value={selected.diameter || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                diameter: e.currentTarget.value || undefined,
              });
              const sku = pickSku(next);
              router.push(`/wheels/${encodeURIComponent(sku)}`);
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.diameters.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Width</span>
          <select
            value={selected.width || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                width: e.currentTarget.value || undefined,
              });
              const sku = pickSku(next);
              router.push(`/wheels/${encodeURIComponent(sku)}`);
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.widths.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Offset</span>
          <select
            value={selected.offset || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                offset: e.currentTarget.value || undefined,
              });
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
              const next = coerce({
                ...selected,
                finish: e.currentTarget.value || undefined,
              });
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
