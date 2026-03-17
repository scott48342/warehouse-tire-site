"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SelectedWheel = {
  sku: string;
  brand?: string;
  title?: string;
  finish?: string;
  price?: number;
  imageUrl?: string;
};

type WheelSpec = {
  boltPattern?: string;
  offset?: string;
  diameter?: string;
  width?: string;
};

export function TiresWorkspaceHeader({
  year,
  make,
  model,
  trim,
  modification,
  wheelSku,
}: {
  year: string;
  make: string;
  model: string;
  trim: string;
  modification: string;
  wheelSku?: string;
}) {
  const fitmentQs = useMemo(() => {
    const sp = new URLSearchParams();
    if (year) sp.set("year", year);
    if (make) sp.set("make", make);
    if (model) sp.set("model", model);
    if (trim) sp.set("trim", trim);
    if (modification) sp.set("modification", modification);
    return sp.toString();
  }, [year, make, model, trim, modification]);

  const [selectedWheel, setSelectedWheel] = useState<SelectedWheel | null>(null);
  const [wheelSpec, setWheelSpec] = useState<WheelSpec | null>(null);

  useEffect(() => {
    if (!wheelSku) return;

    try {
      const raw = localStorage.getItem("wt_selected_wheel");
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.sku === "string") setSelectedWheel(obj);
      }
    } catch {
      // ignore
    }

    // Best-effort spec lookup. If this endpoint doesn't support sku, we'll still show the stored label.
    (async () => {
      try {
        const res = await fetch(`/api/wheelpros/wheels/search?sku=${encodeURIComponent(wheelSku)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();

        const w = Array.isArray(data?.items) ? data.items[0] : data?.item;
        if (!w) return;

        setWheelSpec({
          boltPattern: w?.boltPattern || w?.bolt_pattern,
          offset: w?.offset != null ? String(w.offset) : w?.offsetMm != null ? String(w.offsetMm) : undefined,
          diameter: w?.diameter != null ? String(w.diameter) : undefined,
          width: w?.width != null ? String(w.width) : undefined,
        });
      } catch {
        // ignore
      }
    })();
  }, [wheelSku]);

  if (!year || !make || !model) return null;

  return (
    <div className="sticky top-24 z-30 hidden md:block">
      <div className="mx-auto max-w-[980px] rounded-3xl border border-neutral-200 bg-white/95 p-4 backdrop-blur">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <div className="text-xs font-semibold text-neutral-600">Step 1</div>
            <div className="mt-1 text-sm font-extrabold text-neutral-900">Wheel selected</div>

            {wheelSku ? (
              <div className="mt-2">
                <div className="text-sm font-extrabold text-neutral-900">
                  {selectedWheel?.brand ? `${selectedWheel.brand} ` : ""}
                  {selectedWheel?.title || wheelSku}
                </div>
                {selectedWheel?.finish ? <div className="text-xs text-neutral-600">{selectedWheel.finish}</div> : null}

                {wheelSpec?.diameter || wheelSpec?.width || wheelSpec?.boltPattern || wheelSpec?.offset ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {wheelSpec?.diameter || wheelSpec?.width ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                        {wheelSpec?.diameter || ""}
                        {wheelSpec?.diameter && wheelSpec?.width ? "x" : ""}
                        {wheelSpec?.width || ""}
                      </span>
                    ) : null}
                    {wheelSpec?.boltPattern ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                        {wheelSpec.boltPattern}
                      </span>
                    ) : null}
                    {wheelSpec?.offset ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                        Offset {wheelSpec.offset}mm
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3">
                  <Link
                    href={`/wheels?${fitmentQs}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-sm font-extrabold text-neutral-900"
                  >
                    Change wheel
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-neutral-600">
                No wheel selected yet.
                <div className="mt-2">
                  <Link
                    href={`/wheels?${fitmentQs}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
                  >
                    Select a wheel
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-4">
            <div className="text-xs font-semibold text-neutral-600">Step 2</div>
            <div className="mt-1 text-sm font-extrabold text-neutral-900">Select tires to build your quote</div>
            <div className="mt-1 text-xs text-neutral-600">Choose a tire below. We’ll take you to the quote builder with your wheel + tire selection.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
