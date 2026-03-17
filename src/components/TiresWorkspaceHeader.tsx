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
  diameter?: string;
  width?: string;
  boltPattern?: string;
  offset?: string;
};

type SelectedTire = {
  sku: string;
  brand?: string;
  title?: string;
  size?: string;
  price?: number;
  imageUrl?: string;
  speed?: string;
  loadIndex?: string;
  season?: string;
  runFlat?: boolean;
  xl?: boolean;
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
  tireSku,
}: {
  year: string;
  make: string;
  model: string;
  trim: string;
  modification: string;
  wheelSku?: string;
  tireSku?: string;
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
  const [selectedTire, setSelectedTire] = useState<SelectedTire | null>(null);

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

        const w = Array.isArray(data?.results) ? data.results[0] : data?.result || data?.item || null;
        if (!w) return;

        const props = w?.properties || {};

        setWheelSpec({
          boltPattern: props?.boltPatternMetric || props?.boltPattern || w?.boltPattern || w?.bolt_pattern,
          offset: props?.offset != null ? String(props.offset) : w?.offset != null ? String(w.offset) : undefined,
          diameter: props?.diameter != null ? String(props.diameter) : w?.diameter != null ? String(w.diameter) : undefined,
          width: props?.width != null ? String(props.width) : w?.width != null ? String(w.width) : undefined,
        });
      } catch {
        // ignore
      }
    })();
  }, [wheelSku]);

  useEffect(() => {
    if (!tireSku) {
      setSelectedTire(null);
      return;
    }

    try {
      const raw = localStorage.getItem("wt_selected_tire");
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj.sku === "string") setSelectedTire(obj);
      }
    } catch {
      // ignore
    }
  }, [tireSku]);

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

                {selectedWheel?.diameter ||
                selectedWheel?.width ||
                selectedWheel?.boltPattern ||
                selectedWheel?.offset ||
                wheelSpec?.diameter ||
                wheelSpec?.width ||
                wheelSpec?.boltPattern ||
                wheelSpec?.offset ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedWheel?.diameter || selectedWheel?.width || wheelSpec?.diameter || wheelSpec?.width ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                        {(selectedWheel?.diameter || wheelSpec?.diameter || "") as string}
                        {(selectedWheel?.diameter || wheelSpec?.diameter) &&
                        (selectedWheel?.width || wheelSpec?.width)
                          ? "x"
                          : ""}
                        {(selectedWheel?.width || wheelSpec?.width || "") as string}
                      </span>
                    ) : null}
                    {selectedWheel?.boltPattern || wheelSpec?.boltPattern ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                        {(selectedWheel?.boltPattern || wheelSpec?.boltPattern) as string}
                      </span>
                    ) : null}
                    {selectedWheel?.offset || wheelSpec?.offset ? (
                      <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                        Offset {(selectedWheel?.offset || wheelSpec?.offset) as string}mm
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
            <div className="mt-1 text-sm font-extrabold text-neutral-900">
              {tireSku ? "Tire selected" : "Select tires to build your quote"}
            </div>
            <div className="mt-1 text-xs text-neutral-600">
              {tireSku
                ? "Review your selection and continue to the quote builder."
                : "Select a tire below, then click Add to quote."}
            </div>

            {tireSku ? (
              <div className="mt-2">
                <div className="text-sm font-extrabold text-neutral-900">
                  {selectedTire?.brand ? `${selectedTire.brand} ` : ""}
                  {selectedTire?.title || tireSku}
                </div>
                {selectedTire?.size ? <div className="text-xs text-neutral-600">Size {selectedTire.size}</div> : null}

                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTire?.season ? (
                    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                      {selectedTire.season}
                    </span>
                  ) : null}
                  {selectedTire?.speed ? (
                    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                      Speed {selectedTire.speed}
                    </span>
                  ) : null}
                  {selectedTire?.loadIndex ? (
                    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                      Load {selectedTire.loadIndex}
                    </span>
                  ) : null}
                  {selectedTire?.runFlat ? (
                    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                      Run Flat
                    </span>
                  ) : null}
                  {selectedTire?.xl ? (
                    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                      XL
                    </span>
                  ) : null}
                </div>

                {wheelSku ? (
                  <div className="mt-3">
                    <Link
                      href={`/quote/new?${new URLSearchParams({
                        year,
                        make,
                        model,
                        trim,
                        modification,
                        wheelSku,
                        tireSku,
                      }).toString()}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-extrabold text-white hover:bg-red-700"
                    >
                      Add to quote
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
