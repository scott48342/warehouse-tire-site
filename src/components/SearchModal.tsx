"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FitmentSelector } from "@/components/FitmentSelector";
import { vehicleSlug } from "@/lib/vehicleSlug";

export type Mode = "vehicle" | "size";

function buildUrl(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function normalizeTireSize(width: string, aspect: string, diameter: string) {
  const w = String(width || "").trim();
  const a = String(aspect || "").trim();
  const d = String(diameter || "").trim();
  if (!w || !a || !d) return "";
  return `${w}/${a}R${d}`;
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
  return [f.year, f.make, f.model, f.trim].filter(Boolean).join(" ");
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

  // Tires by size
  const [tireWidth, setTireWidth] = useState("245");
  const [tireAspect, setTireAspect] = useState("45");
  const [tireDiameter, setTireDiameter] = useState("17");

  // Wheels by size (diameter/width + bolt pattern)
  const [wheelDiameter, setWheelDiameter] = useState("20");
  const [wheelWidth, setWheelWidth] = useState("9");
  const [boltPattern, setBoltPattern] = useState("6x139.7");

  const isTires = type === "tires";

  const title = isTires ? "Shop Tires" : "Shop Wheels";

  const currentSp = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  // Reset mode when reopened, so menu actions can choose the starting tab.
  useEffect(() => {
    if (open) setMode(defaultMode || "vehicle");
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
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
          <div className="grid gap-2">
            <button
              onClick={() => setMode("vehicle")}
              className={
                mode === "vehicle"
                  ? "h-12 rounded-xl bg-neutral-900 px-3 text-left text-sm font-extrabold text-white"
                  : "h-12 rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              }
            >
              Shop by vehicle
            </button>

            <button
              onClick={() => setMode("size")}
              className={
                mode === "size"
                  ? "h-12 rounded-xl bg-neutral-900 px-3 text-left text-sm font-extrabold text-white"
                  : "h-12 rounded-xl border border-neutral-200 bg-white px-3 text-left text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              }
            >
              Shop by size
            </button>

            <div className="mt-2 text-xs text-neutral-600">
              This is a first-pass DiscountTire-style menu. We’ll refine options as we add suppliers.
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            {mode === "vehicle" ? (
              <div>
                <div className="text-xs font-semibold text-neutral-700">Vehicle</div>
                <GarageQuickPick
                  onPickTires={(sp) => {
                    const year = sp.get("year") || "";
                    const make = sp.get("make") || "";
                    const model = sp.get("model") || "";
                    const slug = year && make && model ? vehicleSlug(year, make, model) : "";
                    router.push(slug ? buildUrl(`/tires/v/${slug}`, sp) : buildUrl("/tires", sp));
                    onClose();
                  }}
                  onPickWheels={(sp) => {
                    const year = sp.get("year") || "";
                    const make = sp.get("make") || "";
                    const model = sp.get("model") || "";
                    const slug = year && make && model ? vehicleSlug(year, make, model) : "";
                    router.push(slug ? buildUrl(`/wheels/v/${slug}`, sp) : buildUrl("/wheels", sp));
                    onClose();
                  }}
                />

                <div className="mt-2">
                  <FitmentSelector
                    onComplete={(fitment) => {
                      // After trim is selected, immediately navigate (SEO/sharable) and close.
                      const next = new URLSearchParams();
                      for (const k of ["year", "make", "model", "trim", "modification"] as const) {
                        const v = (fitment as any)?.[k];
                        if (v) next.set(k, String(v));
                      }

                      const year = next.get("year") || "";
                      const make = next.get("make") || "";
                      const model = next.get("model") || "";
                      const slug = year && make && model ? vehicleSlug(year, make, model) : "";

                      const target = isTires
                        ? (slug ? `/tires/v/${slug}` : "/tires")
                        : (slug ? `/wheels/v/${slug}` : "/wheels");

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
                    <div className="text-xs font-semibold text-neutral-700">Tire size</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <select
                        value={tireWidth}
                        onChange={(e) => setTireWidth(e.currentTarget.value)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                      >
                        {[175,185,195,205,215,225,235,245,255,265,275,285,295,305,315].map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={tireAspect}
                        onChange={(e) => setTireAspect(e.currentTarget.value)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                      >
                        {[30,35,40,45,50,55,60,65,70,75].map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <select
                        value={tireDiameter}
                        onChange={(e) => setTireDiameter(e.currentTarget.value)}
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
                      >
                        {[14,15,16,17,18,19,20,21,22,23,24].map((n) => (
                          <option key={n} value={String(n)}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-3 text-sm font-extrabold text-neutral-900">
                      {normalizeTireSize(tireWidth, tireAspect, tireDiameter) || "Select size"}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const size = normalizeTireSize(tireWidth, tireAspect, tireDiameter);
                          const next = new URLSearchParams();
                          next.set("size", size);
                          router.push(`/tires?${next.toString()}`);
                          onClose();
                        }}
                        className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                      >
                        Search tires
                      </button>
                    </div>
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
