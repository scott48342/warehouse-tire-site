"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type WheelVariant = {
  sku: string;
  diameter?: string;
  width?: string;
  boltPattern?: string;
  offset?: string;
  finish?: string;
};

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function normNum(v?: string) {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  if (Number.isFinite(n)) return String(n);
  return s;
}

export function WheelVariantSelector({
  variants,
  currentSku,
  selected,
}: {
  variants: WheelVariant[];
  currentSku: string;
  selected: { diameter?: string; width?: string; boltPattern?: string; offset?: string; finish?: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Build URL preserving all existing params (vehicle info, etc.)
  function buildVariantUrl(sku: string, variant?: { diameter?: string; width?: string; offset?: string; boltPattern?: string }) {
    const sp = new URLSearchParams();
    
    // Preserve existing params (year, make, model, trim, modification, etc.)
    searchParams.forEach((value, key) => {
      // Skip old wheel variant params - we'll add fresh ones
      if (!["wheelDia", "wheelWidth", "wheelOffset", "wheelBolt"].includes(key)) {
        sp.set(key, value);
      }
    });
    
    // Add new variant params
    if (variant?.diameter) sp.set("wheelDia", variant.diameter);
    if (variant?.width) sp.set("wheelWidth", variant.width);
    if (variant?.offset) sp.set("wheelOffset", variant.offset);
    if (variant?.boltPattern) sp.set("wheelBolt", variant.boltPattern);
    
    const qs = sp.toString();
    return `/wheels/${encodeURIComponent(sku)}${qs ? `?${qs}` : ""}`;
  }

  const options = useMemo(() => {
    const nSel = {
      diameter: normNum(selected.diameter),
      width: normNum(selected.width),
      offset: normNum(selected.offset),
      boltPattern: selected.boltPattern,
      finish: selected.finish,
    };

    const nVariants = variants.map((v) => ({
      ...v,
      diameter: normNum(v.diameter),
      width: normNum(v.width),
      offset: normNum(v.offset),
    }));

    const diameters = uniqSorted(nVariants.map((v) => v.diameter || ""));

    const byDiameter = nSel.diameter
      ? nVariants.filter((v) => v.diameter === nSel.diameter)
      : nVariants;

    const widths = uniqSorted(byDiameter.map((v) => v.width || ""));

    const byDiameterWidth = nSel.width
      ? byDiameter.filter((v) => v.width === nSel.width)
      : byDiameter;

    const boltPatterns = uniqSorted(byDiameterWidth.map((v) => v.boltPattern || ""));

    const byDiameterWidthBolt = nSel.boltPattern
      ? byDiameterWidth.filter((v) => v.boltPattern === nSel.boltPattern)
      : byDiameterWidth;

    const offsets = uniqSorted(byDiameterWidthBolt.map((v) => v.offset || ""));

    const byDiameterWidthBoltOffset = nSel.offset
      ? byDiameterWidthBolt.filter((v) => v.offset === nSel.offset)
      : byDiameterWidthBolt;

    const finishes = uniqSorted(byDiameterWidthBoltOffset.map((v) => v.finish || ""));

    return { diameters, widths, boltPatterns, offsets, finishes, nSel, nVariants };
  }, [variants, selected.diameter, selected.width, selected.boltPattern, selected.offset, selected.finish]);

  // Pick full variant (not just SKU) so we can include all details in URL
  function pickVariant(nextSel: { diameter?: string; width?: string; boltPattern?: string; offset?: string; finish?: string }): WheelVariant {
    const nNext = {
      diameter: normNum(nextSel.diameter),
      width: normNum(nextSel.width),
      offset: normNum(nextSel.offset),
      boltPattern: nextSel.boltPattern,
      finish: nextSel.finish,
    };

    const exact = options.nVariants.find(
      (v) =>
        (!nNext.diameter || v.diameter === nNext.diameter) &&
        (!nNext.width || v.width === nNext.width) &&
        (!nNext.boltPattern || v.boltPattern === nNext.boltPattern) &&
        (!nNext.offset || v.offset === nNext.offset) &&
        (!nNext.finish || v.finish === nNext.finish)
    );
    if (exact) return exact;

    // Fallback: try to keep the most specific filters first
    const soft = options.nVariants.find(
      (v) =>
        (!nNext.diameter || v.diameter === nNext.diameter) &&
        (!nNext.width || v.width === nNext.width) &&
        (!nNext.boltPattern || v.boltPattern === nNext.boltPattern) &&
        (!nNext.offset || v.offset === nNext.offset)
    );
    return soft || { sku: currentSku, ...nNext };
  }
  
  // Navigate to variant with full URL params preserved
  function navigateToVariant(variant: WheelVariant) {
    router.replace(buildVariantUrl(variant.sku, variant));
  }

  function coerce(nextSel: { diameter?: string; width?: string; boltPattern?: string; offset?: string; finish?: string }) {
    // If a dependent selection no longer exists under the current constraints, clear it.
    const nNext = {
      ...nextSel,
      diameter: normNum(nextSel.diameter),
      width: normNum(nextSel.width),
      offset: normNum(nextSel.offset),
    };

    const byDiameter = nNext.diameter ? options.nVariants.filter((v) => v.diameter === nNext.diameter) : options.nVariants;
    const widths = uniqSorted(byDiameter.map((v) => v.width || ""));
    if (nNext.width && !widths.includes(nNext.width)) nNext.width = undefined;

    const byDiameterWidth = nNext.width ? byDiameter.filter((v) => v.width === nNext.width) : byDiameter;
    const boltPatterns = uniqSorted(byDiameterWidth.map((v) => v.boltPattern || ""));
    if (nNext.boltPattern && !boltPatterns.includes(nNext.boltPattern)) nNext.boltPattern = undefined;

    const byDiameterWidthBolt = nNext.boltPattern
      ? byDiameterWidth.filter((v) => v.boltPattern === nNext.boltPattern)
      : byDiameterWidth;

    const offsets = uniqSorted(byDiameterWidthBolt.map((v) => v.offset || ""));
    if (nNext.offset && !offsets.includes(nNext.offset)) nNext.offset = undefined;

    const byDiameterWidthBoltOffset = nNext.offset
      ? byDiameterWidthBolt.filter((v) => v.offset === nNext.offset)
      : byDiameterWidthBolt;
    const finishes = uniqSorted(byDiameterWidthBoltOffset.map((v) => v.finish || ""));
    if (nNext.finish && !finishes.includes(nNext.finish)) nNext.finish = undefined;

    return nNext;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Diameter</span>
          <select
            value={options.nSel.diameter || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                diameter: e.currentTarget.value || undefined,
              });
              const variant = pickVariant(next);
              navigateToVariant(variant);
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
            value={options.nSel.width || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                width: e.currentTarget.value || undefined,
              });
              navigateToVariant(pickVariant(next));
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
          <span className="text-xs font-extrabold text-neutral-900">Bolt pattern</span>
          <select
            value={options.nSel.boltPattern || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                boltPattern: e.currentTarget.value || undefined,
              });
              navigateToVariant(pickVariant(next));
            }}
            className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {options.boltPatterns.map((bp) => (
              <option key={bp} value={bp}>
                {bp}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-extrabold text-neutral-900">Offset</span>
          <select
            value={options.nSel.offset || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                offset: e.currentTarget.value || undefined,
              });
              navigateToVariant(pickVariant(next));
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
            value={options.nSel.finish || ""}
            onChange={(e) => {
              const next = coerce({
                ...selected,
                finish: e.currentTarget.value || undefined,
              });
              navigateToVariant(pickVariant(next));
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
