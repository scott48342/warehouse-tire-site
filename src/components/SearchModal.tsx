"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FitmentSelector } from "@/components/FitmentSelector";

type Mode = "vehicle" | "size";

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

export function SearchModal({
  open,
  type,
  onClose,
}: {
  open: boolean;
  type: "tires" | "wheels";
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("vehicle");

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
                <div className="mt-2">
                  <FitmentSelector />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      // Keep current fitment params in the URL; user uses FitmentSelector which updates querystring.
                      const target = isTires ? "/tires" : "/wheels";
                      router.push(buildUrl(target, new URLSearchParams(currentSp.toString())));
                      onClose();
                    }}
                    className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
                  >
                    Search
                  </button>
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
                            {n}"
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
                            {n}"
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
