"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type SelectedTire = {
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

export function SelectTireButtonAxle({
  wheelSku,
  axle,
  tire,
}: {
  wheelSku: string;
  axle: "front" | "rear";
  tire: SelectedTire;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const param = axle === "rear" ? "tireSkuRear" : "tireSkuFront";
  const currentSku = sp.get(param) || "";
  const active = Boolean(tire?.sku && currentSku && tire.sku === currentSku);

  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(`wt_selected_tire_${axle}`, JSON.stringify(tire));
        } catch {
          // ignore
        }

        const next = new URLSearchParams(sp.toString());
        next.set("wheelSku", wheelSku);
        next.set(param, tire.sku);
        // After selecting front, nudge user to rear.
        if (axle === "front") next.set("axle", "rear");
        router.replace(`/tires?${next.toString()}`);
      }}
      className={
        "rounded-xl px-4 py-3 text-center text-sm font-extrabold transition " +
        (active ? "bg-neutral-900 text-white" : "bg-red-600 text-white hover:bg-red-700")
      }
    >
      {active ? "Selected" : axle === "rear" ? "Select rear tire" : "Select front tire"}
    </button>
  );
}
