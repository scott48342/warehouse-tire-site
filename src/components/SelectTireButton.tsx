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

export function SelectTireButton({
  wheelSku,
  tire,
}: {
  wheelSku: string;
  tire: SelectedTire;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const currentTireSku = sp.get("tireSku") || "";
  const active = Boolean(tire?.sku && currentTireSku && tire.sku === currentTireSku);

  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem("wt_selected_tire", JSON.stringify(tire));
        } catch {
          // ignore
        }

        const next = new URLSearchParams(sp.toString());
        next.set("wheelSku", wheelSku);
        next.set("tireSku", tire.sku);
        // keep the user on the same page but update the selection state in the URL
        router.replace(`/tires?${next.toString()}`);
      }}
      className={
        "rounded-xl px-4 py-3 text-center text-sm font-extrabold transition " +
        (active
          ? "bg-neutral-900 text-white"
          : "bg-red-600 text-white hover:bg-red-700")
      }
    >
      {active ? "Selected" : "Select tire"}
    </button>
  );
}
