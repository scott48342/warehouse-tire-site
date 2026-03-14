"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const pathname = usePathname();
  const sp = useSearchParams();

  const current = useMemo<Fitment>(() => {
    return {
      year: sp.get("year") ?? undefined,
      make: sp.get("make") ?? undefined,
      model: sp.get("model") ?? undefined,
      trim: sp.get("trim") ?? undefined,
      modification: sp.get("modification") ?? undefined,
    };
  }, [sp]);

  const hasVehicle = Boolean(current.year && current.make && current.model && current.modification);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-extrabold text-neutral-900">My Garage</div>
        <button
          type="button"
          disabled={!hasVehicle}
          onClick={() => {
            const items = readGarage();
            const item: GarageItem = { ...current, savedAt: Date.now() };
            const k = fitmentKey(item);
            const next = [item, ...items.filter((x) => fitmentKey(x) !== k)].slice(0, MAX);
            writeGarage(next);
            // re-render by soft refresh
            router.refresh();
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
        onSelect={(f) => {
          const target = type === "tires" ? "/tires" : "/wheels";
          const next = buildVehicleParams(f);
          router.push(`${target}?${next.toString()}`);
        }}
        onRemove={(f) => {
          const items = readGarage();
          const k = fitmentKey(f);
          writeGarage(items.filter((x) => fitmentKey(x) !== k));
          router.refresh();
        }}
      />

      <div className="text-[11px] text-neutral-500">
        Saved in this browser (max {MAX}).
      </div>
    </div>
  );
}

function GarageList({
  onSelect,
  onRemove,
}: {
  onSelect: (f: Fitment) => void;
  onRemove: (f: Fitment) => void;
}) {
  const items = useMemo(() => {
    const raw = readGarage();
    return [...raw].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX);
  }, []);

  if (!items.length) {
    return <div className="text-xs text-neutral-600">No saved vehicles yet.</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const k = fitmentKey(it);
        return (
          <div key={k} className="flex items-center gap-1 rounded-full border border-neutral-200 bg-white pl-3">
            <button
              type="button"
              onClick={() => onSelect(it)}
              className="py-1 text-xs font-extrabold text-neutral-900 hover:underline"
              title="Search with this vehicle"
            >
              {label(it)}
            </button>
            <button
              type="button"
              onClick={() => onRemove(it)}
              className="rounded-full px-2 py-1 text-xs font-extrabold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              title="Remove"
              aria-label={`Remove ${label(it)}`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
