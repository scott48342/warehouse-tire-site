"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VehicleSelector, type VehicleSelection } from "@/components/VehicleSelector";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";
import tireSizes from "@/data/tire-sizes.json";

export type Mode = "vehicle" | "size";

function buildUrl(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function normalizeTireSize(width: number | null, aspect: number | null, rim: number | null) {
  if (!width || !aspect || !rim) return "";
  return `${width}/${aspect}R${rim}`;
}

function normalizeFlotationSize(dia: number | null, width: number | null, rim: number | null) {
  if (!dia || !width || !rim) return "";
  return `${dia}x${Number(width).toFixed(2)}R${rim}`;
}

function odMmFromMetric(width: number, aspect: number, rim: number) {
  return rim * 25.4 + 2 * (width * (aspect / 100));
}

function bestMetricForFlotation({
  flotation,
  metric,
}: {
  flotation: { dia: number; width: number; rim: number };
  metric: Array<{ width: number; aspect: number; rim: number; label: string }>;
}) {
  const targetOd = flotation.dia * 25.4;
  const targetWidthMm = flotation.width * 25.4;

  // Only consider metric sizes with same rim.
  const sameRim = metric.filter((m) => m.rim === flotation.rim);
  if (!sameRim.length) return null;

  let best: { label: string; score: number } | null = null;
  for (const m of sameRim) {
    const od = odMmFromMetric(m.width, m.aspect, m.rim);
    const odDiff = Math.abs(od - targetOd);
    const wDiff = Math.abs(m.width - targetWidthMm);
    // Heavily weight OD (fitment/speedo), lightly weight width.
    const score = odDiff * 2 + wDiff * 0.5;
    if (!best || score < best.score) best = { label: m.label, score };
  }
  return best?.label || null;
}

type GarageItem = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
  savedAt?: number;
};

function buildVehicleParams(f: GarageItem) {
  const sp = new URLSearchParams();
  for (const k of ["year", "make", "model", "trim", "modification"] as const) {
    const v = (f as any)?.[k];
    if (v) sp.set(k, String(v));
  }
  return sp;
}

function garageLabel(f: GarageItem) {
  // Never show raw engine text - extract clean submodel or omit
  const cleanTrim = extractDisplayTrim(f.trim ?? "");
  return [f.year, f.make, f.model, cleanTrim].filter(Boolean).join(" ");
}

function GarageQuickPick({
  onPickTires,
  onPickWheels,
}: {
  onPickTires: (sp: URLSearchParams) => void;
  onPickWheels: (sp: URLSearchParams) => void;
}) {
  const [items, setItems] = useState<GarageItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wt_garage");
      const data = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(data) ? (data as GarageItem[]) : [];
      setItems([...arr].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, 5));
    } catch {
      setItems([]);
    }
  }, []);

  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-neutral-900">My Garage</div>
        <a href="/favorites" className="text-xs font-semibold text-neutral-600 hover:underline">
          Favorites
        </a>
      </div>

      <div className="mt-3 grid gap-2">
        {items.map((it, idx) => {
          const key = `${it.modification || idx}`;
          const vehicleSp = buildVehicleParams(it);
          const label = garageLabel(it);
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-2">
              <div className="text-xs font-extrabold text-neutral-900">{label}</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPickTires(vehicleSp)}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                  title={`Search tires for ${label}`}
                >
                  Tires
                </button>
                <button
                  type="button"
                  onClick={() => onPickWheels(vehicleSp)}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                  title={`Search wheels for ${label}`}
                >
                  Wheels
                </button>
                <a
                  href="/favorites"
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                >
                  Favorites
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function applyPendingWheelDiameter(next: URLSearchParams) {
  try {
    const raw = localStorage.getItem("wt_pending_wheel_diameter");
    const d = raw ? String(raw).trim() : "";
    if (!d) return;
    if (!next.get("diameter")) next.set("diameter", d);
    if (!next.get("page")) next.set("page", "1");
    localStorage.removeItem("wt_pending_wheel_diameter");
  } catch {
    // ignore
  }
}

export function SearchModal({
  open,
  type,
  defaultMode,
  onClose,
}: {
  open: boolean;
  type: "tires" | "wheels";
  defaultMode?: Mode;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(defaultMode || "vehicle");

  // Tires by size (stepped, limited to real sizes)
  const [tireStep, setTireStep] = useState<"w" | "a" | "r">("w");
  const [tireAspect, setTireAspect] = useState<number | null>(null);
  const [tireWidth, setTireWidth] = useState<number | null>(null);
  const [tireRim, setTireRim] = useState<number | null>(null);

  const [floatStep, setFloatStep] = useState<"d" | "w" | "r">("d");
  const [floatDia, setFloatDia] = useState<number | null>(null);
  const [floatWidth, setFloatWidth] = useState<number | null>(null);
  const [floatRim, setFloatRim] = useState<number | null>(null);

  const [tenPly, setTenPly] = useState(false);

  // Wheels by size (diameter/width + bolt pattern)
  const [wheelDiameter, setWheelDiameter] = useState("20");
  const [wheelWidth, setWheelWidth] = useState("9");
  const [boltPattern, setBoltPattern] = useState("6x139.7");

  const isTires = type === "tires";

  const title = isTires ? "Shop Tires" : "Shop Wheels";

  const currentSp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  // Reset mode when reopened, so menu actions can choose the starting tab.
  useEffect(() => {
    if (open) {
      setMode(defaultMode || "vehicle");

      // Reset size picker state each time.
      setTireStep("w");
      setTireAspect(null);
      setTireWidth(null);
      setTireRim(null);

      setFloatStep("d");
      setFloatDia(null);
      setFloatWidth(null);
      setFloatRim(null);

      setTenPly(false);
    }
  }, [open, defaultMode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-x-0 top-16 mx-auto w-[min(920px,calc(100%-2rem))] rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <div className="text-xs font-semibold text-neutral-600">Find products that fit</div>
            <div className="text-lg font-extrabold text-neutral-900">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("vehicle")}
              className={
                mode === "vehicle"
                  ? "h-10 rounded-xl bg-neutral-900 px-3 text-sm font-extrabold text-white"
                  : "h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              }
            >
              Vehicle
            </button>
            <button
              type="button"
              onClick={() => setMode("size")}
              className={
                mode === "size"
                  ? "h-10 rounded-xl bg-neutral-900 px-3 text-sm font-extrabold text-white"
                  : "h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              }
            >
              Size
            </button>
            <button
              onClick={onClose}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            {mode === "vehicle" ? (
              <div>
                <div className="text-xs font-semibold text-neutral-700">Vehicle</div>
                <GarageQuickPick
                  onPickTires={(sp) => {
                    const merged = new URLSearchParams(currentSp);
                    sp.forEach((v, k) => merged.set(k, v));

                    const year = merged.get("year") || "";
                    const make = merged.get("make") || "";
                    const model = merged.get("model") || "";
                    const slug = year && make && model ? vehicleSlug(year, make, model) : "";
                    router.push(slug ? buildUrl(`/tires/v/${slug}`, merged) : buildUrl("/tires", merged));
                    onClose();
                  }}
                  onPickWheels={(sp) => {
                    const merged = new URLSearchParams(currentSp);
                    sp.forEach((v, k) => merged.set(k, v));

                    const year = merged.get("year") || "";
                    const make = merged.get("make") || "";
                    const model = merged.get("model") || "";
                    const slug = year && make && model ? vehicleSlug(year, make, model) : "";
                    applyPendingWheelDiameter(merged);
                    router.push(slug ? buildUrl(`/wheels/v/${slug}`, merged) : buildUrl("/wheels", merged));
                    onClose();
                  }}
                />

                <div className="mt-2">
                  <VehicleSelector
                    onSelect={(selection: VehicleSelection) => {
                      // After trim is selected, immediately navigate (SEO/sharable) and close.
                      // Preserve any existing params (e.g. quote carry-over like wheelSku).
                      const next = new URLSearchParams(currentSp);
                      next.set("year", selection.year);
                      next.set("make", selection.make);
                      next.set("model", selection.model);
                      if (selection.trim) next.set("trim", selection.trim);
                      if (selection.modification) next.set("modification", selection.modification);

                      const slug = vehicleSlug(selection.year, selection.make, selection.model);

                      const target = isTires
                        ? `/tires/v/${slug}`
                        : `/wheels/v/${slug}`;

                      if (!isTires) applyPendingWheelDiameter(next);
                      router.push(buildUrl(target, next));
                      onClose();
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      router.push(isTires ? "/tires" : "/wheels");
                      onClose();
                    }}
                    className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
                  >
                    Clear vehicle
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {isTires ? (
                  <div>
                    <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3">
                      <label className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-neutral-900">10‑ply (E‑load) preference</div>
                          <div className="mt-0.5 text-[11px] text-neutral-600">Default is standard load.</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-900">
                          <input type="checkbox" checked={tenPly} onChange={(e) => setTenPly(e.target.checked)} />
                          {tenPly ? "ON" : "OFF"}
                        </div>
                      </label>
                    </div>

                    <>
                      <div className="text-xs font-extrabold text-neutral-900">Metric sizes</div>
                      <div className="mt-3">
                        <div className="text-xs font-extrabold text-neutral-900">
                          {tireStep === "w" ? "Select Width" : tireStep === "a" ? "Select Aspect" : "Select Rim"}
                        </div>

                        {(() => {
                          const metric = Array.isArray((tireSizes as any)?.metric) ? ((tireSizes as any).metric as string[]) : [];
                          const parsed = metric
                            .map((s) => {
                              const m = String(s).match(/^(\d{3})\/(\d{2})R(\d{2})$/);
                              if (!m) return null;
                              return { width: Number(m[1]), aspect: Number(m[2]), rim: Number(m[3]), label: s };
                            })
                            .filter(Boolean) as Array<{ width: number; aspect: number; rim: number; label: string }>;

                          const aspects = Array.from(
                            new Set(parsed.filter((x) => (tireWidth ? x.width === tireWidth : true)).map((x) => x.aspect))
                          ).sort((a, b) => a - b);
                          const widths = Array.from(new Set(parsed.map((x) => x.width))).sort((a, b) => a - b);
                          const rims = Array.from(
                            new Set(
                              parsed
                                .filter((x) => (tireWidth ? x.width === tireWidth : true))
                                .filter((x) => (tireAspect ? x.aspect === tireAspect : true))
                                .map((x) => x.rim)
                            )
                          ).sort((a, b) => a - b);

                          const selected = normalizeTireSize(tireWidth, tireAspect, tireRim);

                          function Btn({ n, active, onClick }: { n: number; active: boolean; onClick: () => void }) {
                            return (
                              <button
                                type="button"
                                onClick={onClick}
                                className={
                                  "rounded-full border px-3 py-1 text-xs font-extrabold " +
                                  (active
                                    ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]"
                                    : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50")
                                }
                              >
                                {n}
                              </button>
                            );
                          }

                          return (
                            <>
                              {tireStep === "w" ? (
                                <div className="mt-2 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                                  {widths.map((w) => (
                                    <Btn
                                      key={w}
                                      n={w}
                                      active={tireWidth === w}
                                      onClick={() => {
                                        setTireWidth(w);
                                        setTireAspect(null);
                                        setTireRim(null);
                                        setTireStep("a");
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              {tireStep === "a" ? (
                                <div className="mt-2 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                                  {aspects.map((a) => (
                                    <Btn
                                      key={a}
                                      n={a}
                                      active={tireAspect === a}
                                      onClick={() => {
                                        setTireAspect(a);
                                        setTireRim(null);
                                        setTireStep("r");
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              {tireStep === "r" ? (
                                <div className="mt-2 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                                  {rims.map((r) => (
                                    <Btn
                                      key={r}
                                      n={r}
                                      active={tireRim === r}
                                      onClick={() => {
                                        const nextSize = normalizeTireSize(tireWidth, tireAspect, r);
                                        if (!nextSize) {
                                          setTireRim(r);
                                          return;
                                        }
                                        const next = new URLSearchParams();
                                        next.set("size", nextSize);
                                        if (tenPly) next.set("load", "10ply");
                                        router.push(`/tires?${next.toString()}`);
                                        onClose();
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 text-sm font-extrabold text-neutral-900">
                                {selected || "Select size"}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {tireStep !== "w" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (tireStep === "r") {
                                        setTireStep("a");
                                        setTireRim(null);
                                        return;
                                      }
                                      if (tireStep === "a") {
                                        setTireStep("w");
                                        setTireAspect(null);
                                      }
                                    }}
                                    className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
                                  >
                                    Back
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setTireStep("w");
                                    setTireAspect(null);
                                    setTireWidth(null);
                                    setTireRim(null);
                                  }}
                                  className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
                                >
                                  Reset
                                </button>

                                <button
                                  type="button"
                                  disabled={!selected}
                                  onClick={() => {
                                    const next = new URLSearchParams();
                                    next.set("size", selected);
                                    if (tenPly) next.set("load", "10ply");
                                    router.push(`/tires?${next.toString()}`);
                                    onClose();
                                  }}
                                  className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)] disabled:opacity-60"
                                >
                                  Search tires
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="mt-6 h-px bg-neutral-200" />

                      <div className="mt-3">
                        <div className="text-xs font-extrabold text-neutral-900">Flotation sizes</div>
                        <div className="text-xs font-extrabold text-neutral-900">
                          {floatStep === "d" ? "Select Diameter" : floatStep === "w" ? "Select Width" : "Select Rim"}
                        </div>

                        {(() => {
                          const rows = Array.isArray((tireSizes as any)?.flotation) ? ((tireSizes as any).flotation as any[]) : [];
                          const parsed = rows
                            .map((x) => ({
                              dia: Number(x?.dia),
                              width: Number(x?.width),
                              rim: Number(x?.rim),
                            }))
                            .filter((x) => [x.dia, x.width, x.rim].every((n) => Number.isFinite(n) && n > 0));

                          const dias = Array.from(new Set(parsed.map((x) => x.dia))).sort((a, b) => a - b);
                          const widths = Array.from(
                            new Set(parsed.filter((x) => (floatDia ? x.dia === floatDia : true)).map((x) => x.width))
                          ).sort((a, b) => a - b);
                          const rims = Array.from(
                            new Set(
                              parsed
                                .filter((x) => (floatDia ? x.dia === floatDia : true))
                                .filter((x) => (floatWidth ? x.width === floatWidth : true))
                                .map((x) => x.rim)
                            )
                          ).sort((a, b) => a - b);

                          const selected = normalizeFlotationSize(floatDia, floatWidth, floatRim);

                          // Pre-parse metric sizes so we can map flotation -> closest metric for supplier search.
                          const metricRaw = Array.isArray((tireSizes as any)?.metric) ? ((tireSizes as any).metric as string[]) : [];
                          const metricParsed = metricRaw
                            .map((s) => {
                              const m = String(s).match(/^(\d{3})\/(\d{2})R(\d{2})$/);
                              if (!m) return null;
                              return { width: Number(m[1]), aspect: Number(m[2]), rim: Number(m[3]), label: s };
                            })
                            .filter(Boolean) as Array<{ width: number; aspect: number; rim: number; label: string }>;

                          function Btn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
                            return (
                              <button
                                type="button"
                                onClick={onClick}
                                className={
                                  "rounded-full border px-3 py-1 text-xs font-extrabold " +
                                  (active
                                    ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]"
                                    : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50")
                                }
                              >
                                {label}
                              </button>
                            );
                          }

                          return (
                            <>
                              {floatStep === "d" ? (
                                <div className="mt-2 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                                  {dias.map((d) => (
                                    <Btn
                                      key={d}
                                      label={String(d)}
                                      active={floatDia === d}
                                      onClick={() => {
                                        setFloatDia(d);
                                        setFloatWidth(null);
                                        setFloatRim(null);
                                        setFloatStep("w");
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              {floatStep === "w" ? (
                                <div className="mt-2 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                                  {widths.map((w) => (
                                    <Btn
                                      key={w}
                                      label={w.toFixed(2)}
                                      active={floatWidth === w}
                                      onClick={() => {
                                        setFloatWidth(w);
                                        setFloatRim(null);
                                        setFloatStep("r");
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              {floatStep === "r" ? (
                                <div className="mt-2 flex max-h-[360px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                                  {rims.map((r) => (
                                    <Btn
                                      key={r}
                                      label={String(r)}
                                      active={floatRim === r}
                                      onClick={() => {
                                        const final = normalizeFlotationSize(floatDia, floatWidth, r);
                                        if (!final) {
                                          setFloatRim(r);
                                          return;
                                        }

                                        const mapped = bestMetricForFlotation({
                                          flotation: { dia: floatDia as number, width: floatWidth as number, rim: r },
                                          metric: metricParsed,
                                        });

                                        // Build rawSize digits (TireConnect style): 37x13.50R22 -> 37135022
                                        const rawSize = (() => {
                                          const m = final.match(/^(\d{2})x(\d{1,2}\.\d{2})R(\d{2}(?:\.5)?)$/i);
                                          if (!m) return "";
                                          const dia = m[1];
                                          const w = m[2].replace(".", "");
                                          const rim = m[3].replace(".", "");
                                          return `${dia}${w}${rim}`;
                                        })();

                                        const next = new URLSearchParams();
                                        // Keep the original flotation selection for UI/debug.
                                        next.set("flotation", final);

                                        // For KM, use rawSize digits if available.
                                        // For WP, keep a best-effort metric mapping.
                                        if (rawSize) next.set("size", rawSize);
                                        if (mapped) next.set("metricSize", mapped);

                                        if (tenPly) next.set("load", "10ply");

                                        router.push(`/tires?${next.toString()}`);
                                        onClose();
                                      }}
                                    />
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-3 text-sm font-extrabold text-neutral-900">
                                {selected || "Select size"}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {floatStep !== "d" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (floatStep === "r") {
                                        setFloatStep("w");
                                        setFloatRim(null);
                                        return;
                                      }
                                      if (floatStep === "w") {
                                        setFloatStep("d");
                                        setFloatWidth(null);
                                        setFloatDia(null);
                                      }
                                    }}
                                    className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
                                  >
                                    Back
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setFloatStep("d");
                                    setFloatDia(null);
                                    setFloatWidth(null);
                                    setFloatRim(null);
                                  }}
                                  className="h-11 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
                                >
                                  Reset
                                </button>

                                <button
                                  type="button"
                                  disabled={!selected}
                                  onClick={() => {
                                    const next = new URLSearchParams();
                                    next.set("size", selected);
                                    if (tenPly) next.set("load", "10ply");
                                    router.push(`/tires?${next.toString()}`);
                                    onClose();
                                  }}
                                  className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)] disabled:opacity-60"
                                >
                                  Search tires
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-neutral-700">Wheel size</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <select
                        value={wheelDiameter}
                        onChange={(e) => setWheelDiameter(e.currentTarget.value)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                      >
                        {[15,16,17,18,19,20,21,22,23,24].map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={wheelWidth}
                        onChange={(e) => setWheelWidth(e.currentTarget.value)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                      >
                        {[6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,12].map((n) => (
                          <option key={String(n)} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <input
                        value={boltPattern}
                        onChange={(e) => setBoltPattern(e.currentTarget.value)}
                        placeholder="e.g. 5x114.3"
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const next = new URLSearchParams();
                          next.set("diameter", wheelDiameter);
                          next.set("width", wheelWidth);
                          next.set("boltPattern", boltPattern);
                          applyPendingWheelDiameter(next);
                          router.push(`/wheels?${next.toString()}`);
                          onClose();
                        }}
                        className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                      >
                        Search wheels
                      </button>
                    </div>

                    <div className="mt-2 text-xs text-neutral-600">
                      Note: WheelPros search is currently fitment-driven; we’ll wire these params into the query once the API supports it.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
          Tip: This modal is meant to replace the old “always visible” selector on mobile and feel like DiscountTire’s flow.
        </div>
      </div>
    </div>
  );
}
