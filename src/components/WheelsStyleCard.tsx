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

export function WheelsStyleCard({
  brand,
  title,
  baseSku,
  baseFinish,
  baseImageUrl,
  price,
  sizeLabel,
  finishThumbs,
}: {
  brand: string;
  title: string;
  baseSku: string;
  baseFinish?: string;
  baseImageUrl?: string;
  price?: number;
  sizeLabel?: string;
  finishThumbs?: WheelFinishThumb[];
}) {
  const thumbs = useMemo(() => (finishThumbs || []).filter((t) => t?.sku), [finishThumbs]);

  const [selectedSku, setSelectedSku] = useState<string>(baseSku);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(baseImageUrl);
  const [selectedFinish, setSelectedFinish] = useState<string | undefined>(baseFinish);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(price);

  const viewHref = `/wheels/${encodeURIComponent(selectedSku || baseSku)}`;

  return (
    <div className="block rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-neutral-600">{brand}</div>
        <FavoritesButton
          type="wheel"
          sku={selectedSku || baseSku}
          label={`${brand} ${title}${selectedFinish ? ` - ${selectedFinish}` : ""}`}
          href={viewHref}
          imageUrl={selectedImage}
        />
      </div>

      <Link href={viewHref} className="block">
        <h3 className="mt-0.5 text-sm font-extrabold text-neutral-900">{title}</h3>
        {selectedFinish ? <div className="mt-1 text-xs text-neutral-600">{selectedFinish}</div> : null}
        {sizeLabel ? <div className="mt-0.5 text-xs font-semibold text-neutral-700">{sizeLabel}</div> : null}

        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
          {selectedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedImage}
              alt={title}
              className="h-40 w-full object-contain bg-white"
              loading="lazy"
            />
          ) : (
            <div className="p-3 text-xs text-neutral-700">No image</div>
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

      <div className="mt-4">
        <div className="text-2xl font-extrabold text-neutral-900">
          {typeof selectedPrice === "number" ? `$${selectedPrice.toFixed(2)}` : "Call for price"}
        </div>
        <div className="text-xs text-neutral-600">each</div>
      </div>

      <div className="mt-4 grid gap-2">
        <Link
          href={viewHref}
          className="rounded-xl bg-neutral-900 px-3 py-2 text-center text-xs font-extrabold text-white"
        >
          View details
        </Link>
        <div className="flex items-center justify-between gap-3 text-xs">
          <a href={BRAND.links.tel} className="font-extrabold text-neutral-900 hover:underline">
            Call
          </a>
        </div>
      </div>
    </div>
  );
}
