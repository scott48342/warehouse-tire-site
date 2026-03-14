"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Fitment = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
};

type GarageItem = Fitment & {
  savedAt: number;
};

const KEY = "wt_garage";
const MAX = 5;

function readGarage(): GarageItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as GarageItem[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeGarage(items: GarageItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // ignore
  }
}

function fitmentKey(f: Fitment) {
  return [f.year, f.make, f.model, f.modification].filter(Boolean).join("|");
}

function label(f: Fitment) {
  const parts = [f.year, f.make, f.model, f.trim].filter(Boolean);
  return parts.join(" ");
}

function buildVehicleParams(f: Fitment) {
  const sp = new URLSearchParams();
  for (const k of ["year", "make", "model", "trim", "modification"] as const) {
    const v = f[k];
    if (v) sp.set(k, v);
  }
  return sp;
}

export function GarageWidget({
  type,
}: {
  type: "tires" | "wheels";
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [garage, setGarage] = useState<GarageItem[]>([]);
  useEffect(() => {
    setGarage(readGarage().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, MAX));
  }, []);

  const current = useMemo<Fitment>(() => {
    const fromUrl: Fitment = {
      year: sp.get("year") ?? undefined,
      make: sp.get("make") ?? undefined,
      model: sp.get("model") ?? undefined,
      trim: sp.get("trim") ?? undefined,
      modification: sp.get("modification") ?? undefined,
    };

    // If modification isn't present in the URL yet, fall back to saved fitment from localStorage.
    // This can happen when navigation/search happened before the URL was fully populated.
    if (!fromUrl.modification) {
      try {
        const raw = localStorage.getItem("wt_fitment") || localStorage.getItem("wt_fitment_draft");
        if (raw) {
          const saved = JSON.parse(raw) as any;
          return {
            year: fromUrl.year || saved?.year,
            make: fromUrl.make || saved?.make,
            model: fromUrl.model || saved?.model,
            trim: fromUrl.trim || saved?.trim,
            modification: saved?.modification,
          };
        }
      } catch {}
    }

    return fromUrl;
  }, [sp]);

  const hasVehicle = Boolean(current.year && current.make && current.model && current.modification);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-neutral-900">My Garage</div>
        <a href="/favorites" className="text-xs font-semibold text-neutral-600 hover:underline">
          Favorites
        </a>
        <button
          type="button"
          disabled={!hasVehicle}
          onClick={() => {
            const items = readGarage();
            const item: GarageItem = { ...current, savedAt: Date.now() };
            const k = fitmentKey(item);
            const next = [item, ...items.filter((x) => fitmentKey(x) !== k)]
              .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
              .slice(0, MAX);
            writeGarage(next);
            setGarage(next);
          }}
          className={
            "h-9 rounded-xl px-3 text-xs font-extrabold " +
            (hasVehicle
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "cursor-not-allowed border border-neutral-200 bg-neutral-50 text-neutral-400")
          }
        >
          Save this vehicle
        </button>
      </div>

      <GarageList
        items={garage}
        onRemove={(f) => {
          const k = fitmentKey(f);
          const next = garage.filter((x) => fitmentKey(x) !== k);
          writeGarage(next);
          setGarage(next);
        }}
      />

      <div className="text-[11px] text-neutral-500">
        Saved in this browser (max {MAX}).
      </div>
    </div>
  );
}

function GarageList({
  items,
  onRemove,
}: {
  items: GarageItem[];
  onRemove: (f: Fitment) => void;
}) {
  const router = useRouter();

  if (!items.length) {
    return <div className="text-xs text-neutral-600">No saved vehicles yet.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const k = fitmentKey(it);
        const qs = buildVehicleParams(it).toString();
        return (
          <div
            key={k}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2"
          >
            <div className="mr-auto text-xs font-extrabold text-neutral-900">
              {label(it)}
            </div>

            <button
              type="button"
              onClick={() => router.push(`/tires?${qs}`)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Tires
            </button>
            <button
              type="button"
              onClick={() => router.push(`/wheels?${qs}`)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Wheels
            </button>
            <button
              type="button"
              onClick={() => router.push(`/favorites`)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Favorites
            </button>

            <button
              type="button"
              onClick={() => onRemove(it)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-extrabold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              title="Remove"
              aria-label={`Remove ${label(it)}`}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
