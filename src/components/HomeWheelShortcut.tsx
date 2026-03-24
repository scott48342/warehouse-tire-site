"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchModal } from "@/components/SearchModal";
import { vehicleSlug } from "@/lib/vehicleSlug";

type Fitment = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
};

function getSavedFitment(): Fitment {
  try {
    const raw = localStorage.getItem("wt_fitment") || localStorage.getItem("wt_fitment_draft");
    const f = raw ? (JSON.parse(raw) as Partial<Fitment>) : {};
    return {
      year: f.year ? String(f.year) : undefined,
      make: f.make ? String(f.make) : undefined,
      model: f.model ? String(f.model) : undefined,
      trim: f.trim ? String(f.trim) : undefined,
      modification: f.modification ? String(f.modification) : undefined,
    };
  } catch {
    return {};
  }
}

function setPendingWheelDiameter(d: number) {
  try {
    localStorage.setItem("wt_pending_wheel_diameter", String(d));
  } catch {}
}

function buildWheelUrl(f: Fitment, diameter: number) {
  const sp = new URLSearchParams();
  if (f.year) sp.set("year", f.year);
  if (f.make) sp.set("make", f.make);
  if (f.model) sp.set("model", f.model);
  if (f.trim) sp.set("trim", f.trim);
  if (f.modification) sp.set("modification", f.modification);
  sp.set("diameter", String(diameter));
  sp.set("page", "1");

  const slug = f.year && f.make && f.model ? vehicleSlug(f.year, f.make, f.model) : "";
  const base = slug ? `/wheels/v/${slug}` : "/wheels";
  return `${base}?${sp.toString()}`;
}

export function HomeWheelShortcut({
  title,
  desc,
  diameter,
}: {
  title: string;
  desc: string;
  diameter: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const hrefPreview = useMemo(() => `/wheels?diameter=${encodeURIComponent(String(diameter))}`,
    [diameter]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          const f = getSavedFitment();
          const hasVehicle = Boolean(f.year && f.make && f.model);
          if (!hasVehicle) {
            setPendingWheelDiameter(diameter);
            setOpen(true);
            return;
          }
          router.push(buildWheelUrl(f, diameter));
        }}
        className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50 w-full"
        title={hrefPreview}
      >
        <span className="text-lg">⚙️</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-neutral-900 group-hover:text-amber-900">{title}</div>
          <div className="text-xs text-neutral-500">{desc}</div>
        </div>
        <span className="text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-amber-600">→</span>
      </button>

      {open ? (
        <SearchModal
          open={open}
          type="wheels"
          defaultMode="vehicle"
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
