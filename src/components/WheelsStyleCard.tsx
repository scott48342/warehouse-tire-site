"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import { FavoritesButton } from "@/components/FavoritesButton";

export type WheelFinishThumb = {
  finish: string;
  sku: string;
  imageUrl?: string;
  price?: number;
};

function fmtSizePart(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  // trim trailing zeros like 20.0 -> 20, 11.00 -> 11
  return n.toString();
}

export function WheelsStyleCard({
  brand,
  title,
  baseSku,
  baseFinish,
  baseImageUrl,
  price,
  sizeLabel,
  finishThumbs,
  viewParams,
  specLabel,
}: {
  brand: string;
  title: string;
  baseSku: string;
  baseFinish?: string;
  baseImageUrl?: string;
  price?: number;
  sizeLabel?: { diameter?: string; width?: string };
  finishThumbs?: WheelFinishThumb[];
  viewParams?: Record<string, string | undefined>;
  specLabel?: { boltPattern?: string; offset?: string };
}) {
  const thumbs = useMemo(() => (finishThumbs || []).filter((t) => t?.sku), [finishThumbs]);

  const [selectedSku, setSelectedSku] = useState<string>(baseSku);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(baseImageUrl);
  const [selectedFinish, setSelectedFinish] = useState<string | undefined>(baseFinish);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(price);

  // Visual-only: show "from" pricing when we have multiple finishes.
  const fromPrice = useMemo(() => {
    const ps = (finishThumbs || [])
      .map((t) => (typeof t?.price === "number" ? t.price : null))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (!ps.length) return undefined;
    return Math.min(...ps);
  }, [finishThumbs]);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(viewParams || {})) {
      if (v) sp.set(k, v);
    }
    // Keep links clean if no vehicle selected.
    if (!sp.get("year") || !sp.get("make") || !sp.get("model")) {
      sp.delete("year");
      sp.delete("make");
      sp.delete("model");
      sp.delete("trim");
      sp.delete("modification");
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  }, [viewParams]);

  const viewHref = `/wheels/${encodeURIComponent(selectedSku || baseSku)}${qs}`;

  const bolt = specLabel?.boltPattern ? String(specLabel.boltPattern).trim() : "";
  const off = specLabel?.offset ? String(specLabel.offset).trim() : "";

  return (
    <div className="relative block overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 hover:border-red-300 hover:shadow-sm">
      <div className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-red-500" />
      <div className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-red-500" />

      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-neutral-600">{brand}</div>
        <FavoritesButton
          type="wheel"
          sku={selectedSku || baseSku}
          label={`${brand} ${title}${selectedFinish ? ` - ${selectedFinish}` : ""}`}
          href={viewHref}
          imageUrl={selectedImage}
        />
      </div>

      <Link href={viewHref} className="block">
        <h3 className="mt-1 text-base font-extrabold tracking-tight text-neutral-900">{title}</h3>
        {selectedFinish ? <div className="mt-1 text-sm text-neutral-600">{selectedFinish}</div> : null}

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-extrabold text-red-900">
            Fast shipping
          </span>
          <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-extrabold text-red-900">
            Fitment checked
          </span>
          {thumbs.length > 1 ? (
            <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
              {thumbs.length} finishes
            </span>
          ) : null}
        </div>

        {sizeLabel?.diameter || sizeLabel?.width ? (
          <div className="mt-1 text-sm font-semibold text-neutral-700">
            {fmtSizePart(sizeLabel.diameter || "")}
            {sizeLabel.diameter && sizeLabel.width ? "x" : ""}
            {fmtSizePart(sizeLabel.width || "")}
          </div>
        ) : null}

        {bolt || off ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {bolt ? (
              <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                {bolt}
              </span>
            ) : null}
            {off ? (
              <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-extrabold text-neutral-900">
                Offset {off}mm
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
          {selectedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedImage}
              alt={title}
              className="h-56 w-full object-contain bg-white transition-transform duration-200 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="grid h-56 place-items-center bg-white p-3 text-center">
              <div>
                <div className="text-xs font-extrabold text-neutral-900">Image coming soon</div>
                <div className="mt-1 text-[11px] text-neutral-600">{brand}</div>
              </div>
            </div>
          )}
        </div>
      </Link>

      {thumbs.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {thumbs.slice(0, 8).map((t) => {
            const active = t.sku === selectedSku;
            return (
              <button
                key={t.sku}
                type="button"
                onClick={() => {
                  setSelectedSku(t.sku);
                  setSelectedFinish(t.finish);
                  if (t.imageUrl) setSelectedImage(t.imageUrl);
                  if (typeof t.price === "number") setSelectedPrice(t.price);
                }}
                className={
                  "overflow-hidden rounded-lg border bg-white " +
                  (active ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-300")
                }
                title={t.finish}
                aria-pressed={active}
              >
                {t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.imageUrl} alt={t.finish} className="h-10 w-10 object-contain" loading="lazy" />
                ) : (
                  <div className="h-10 w-10 bg-neutral-50" />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5">
        <div className="text-3xl font-extrabold text-neutral-900">
          {typeof selectedPrice === "number"
            ? `$${selectedPrice.toFixed(2)}`
            : (typeof fromPrice === "number" ? `From $${fromPrice.toFixed(2)}` : "Call for price")}
        </div>
        <div className="text-sm text-neutral-600">each</div>
      </div>

      <div className="mt-5 grid gap-3">
        {typeof selectedPrice === "number" ? (
          <Link
            href={viewHref}
            className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-red-700"
          >
            View details
          </Link>
        ) : (
          <a
            href={BRAND.links.tel}
            className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-red-700"
          >
            Call for price
          </a>
        )}

        <div className="flex items-center justify-between gap-3 text-xs">
          <a href={BRAND.links.tel} className="font-extrabold text-neutral-900 hover:underline">
            Call
          </a>
        </div>
      </div>
    </div>
  );
}
