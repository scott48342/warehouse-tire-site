"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import { FavoritesButton } from "@/components/FavoritesButton";

export type WheelFinishThumb = {
  finish: string;
  sku: string;
  imageUrl?: string;
  price?: number;
  pair?: WheelPair;
};

export type WheelPick = {
  sku: string;
  diameter?: string;
  width?: string;
  offset?: string;
};

export type WheelPair = {
  staggered: boolean;
  front: WheelPick;
  rear?: WheelPick;
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
  selectToTires,
  pair,
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
  /** When true, clicking the card selects the wheel and navigates to /tires automatically. */
  selectToTires?: boolean;
  /** Optional recommended front/rear pairing (Tireweb-style staggered support). */
  pair?: WheelPair;
}) {
  const router = useRouter();
  const thumbs = useMemo(() => (finishThumbs || []).filter((t) => t?.sku), [finishThumbs]);

  const [selectedSku, setSelectedSku] = useState<string>(baseSku);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(baseImageUrl);
  const [selectedFinish, setSelectedFinish] = useState<string | undefined>(baseFinish);
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>(price);
  const [selectedPair, setSelectedPair] = useState<WheelPair | undefined>(pair);

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

  function selectAndGoToTires() {
    const sku = selectedSku || baseSku;

    const p = selectedPair;
    const front = p?.front?.sku ? p.front : { sku, diameter: sizeLabel?.diameter, width: sizeLabel?.width, offset: specLabel?.offset };
    const rear = p?.staggered && p?.rear?.sku ? p.rear : undefined;

    try {
      localStorage.setItem(
        "wt_selected_wheel",
        JSON.stringify({
          sku: front.sku,
          brand,
          title,
          finish: selectedFinish,
          price: selectedPrice,
          imageUrl: selectedImage,
          diameter: front.diameter ?? sizeLabel?.diameter,
          width: front.width ?? sizeLabel?.width,
          boltPattern: specLabel?.boltPattern,
          offset: front.offset ?? specLabel?.offset,
          rearSku: rear?.sku,
          rearDiameter: rear?.diameter,
          rearWidth: rear?.width,
          rearOffset: rear?.offset,
          staggered: Boolean(rear?.sku),
        })
      );
    } catch {
      // ignore
    }

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

    sp.set("wheelSku", front.sku);
    sp.set("wheelSkuFront", front.sku);
    if (rear?.sku) sp.set("wheelSkuRear", rear.sku);

    const dia = front.diameter ?? sizeLabel?.diameter;
    const wFront = front.width ?? sizeLabel?.width;
    const wRear = rear?.width;

    if (dia) sp.set("wheelDia", String(dia));
    if (dia) sp.set("wheelDiaFront", String(dia));
    if (rear?.diameter) sp.set("wheelDiaRear", String(rear.diameter));

    if (wFront) sp.set("wheelWidth", String(wFront));
    if (wFront) sp.set("wheelWidthFront", String(wFront));
    if (wRear) sp.set("wheelWidthRear", String(wRear));

    router.push(`/tires?${sp.toString()}`);
  }

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

      {thumbs.length > 1 ? (
        <div className="mt-3">
          <label className="text-[11px] font-semibold text-neutral-600">Finish</label>
          <select
            value={selectedFinish || ""}
            onChange={(e) => {
              const fin = e.target.value;
              const hit = thumbs.find((t) => String(t.finish) === fin);
              setSelectedFinish(fin);
              if (hit?.sku) setSelectedSku(hit.sku);
              if (hit?.imageUrl) setSelectedImage(hit.imageUrl);
              if (typeof hit?.price === "number") setSelectedPrice(hit.price);
              if (hit?.pair) setSelectedPair(hit.pair);
            }}
            className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold"
          >
            {thumbs.map((t) => (
              <option key={t.sku || t.finish} value={t.finish}>
                {t.finish}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectToTires ? (
        <button
          type="button"
          onClick={() => selectAndGoToTires()}
          className="block w-full text-left"
        >
          <h3 className="mt-1 text-base font-extrabold tracking-tight text-neutral-900">{title}</h3>
        {selectedFinish ? <div className="mt-1 text-sm text-neutral-600">{selectedFinish}</div> : null}

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-extrabold text-red-900">
            Fast shipping
          </span>
          <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-extrabold text-red-900">
            Fitment checked
          </span>
          {thumbs.length > 1 ? null : null}
        </div>

        {selectedPair?.front?.diameter || selectedPair?.front?.width || sizeLabel?.diameter || sizeLabel?.width ? (
          <div className="mt-1 grid gap-1 text-sm font-semibold text-neutral-700">
            <div>
              Front: {fmtSizePart(selectedPair?.front?.diameter || sizeLabel?.diameter || "")}
              {(selectedPair?.front?.diameter || sizeLabel?.diameter) && (selectedPair?.front?.width || sizeLabel?.width) ? "x" : ""}
              {fmtSizePart(selectedPair?.front?.width || sizeLabel?.width || "")}
              {selectedPair?.front?.offset ? <span className="text-neutral-500"> • ET {String(selectedPair.front.offset)}</span> : null}
            </div>
            {selectedPair?.staggered && selectedPair?.rear?.sku ? (
              <div>
                Rear: {fmtSizePart(selectedPair?.rear?.diameter || selectedPair?.front?.diameter || "")}
                {(selectedPair?.rear?.diameter || selectedPair?.front?.diameter) && selectedPair?.rear?.width ? "x" : ""}
                {fmtSizePart(selectedPair?.rear?.width || "")}
                {selectedPair?.rear?.offset ? <span className="text-neutral-500"> • ET {String(selectedPair.rear.offset)}</span> : null}
              </div>
            ) : null}
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
        </button>
      ) : (
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
            {thumbs.length > 1 ? null : null}
          </div>

          {selectedPair?.front?.diameter || selectedPair?.front?.width || sizeLabel?.diameter || sizeLabel?.width ? (
            <div className="mt-1 grid gap-1 text-sm font-semibold text-neutral-700">
              <div>
                Front: {fmtSizePart(selectedPair?.front?.diameter || sizeLabel?.diameter || "")}
                {(selectedPair?.front?.diameter || sizeLabel?.diameter) && (selectedPair?.front?.width || sizeLabel?.width) ? "x" : ""}
                {fmtSizePart(selectedPair?.front?.width || sizeLabel?.width || "")}
                {selectedPair?.front?.offset ? <span className="text-neutral-500"> • ET {String(selectedPair.front.offset)}</span> : null}
              </div>
              {selectedPair?.staggered && selectedPair?.rear?.sku ? (
                <div>
                  Rear: {fmtSizePart(selectedPair?.rear?.diameter || selectedPair?.front?.diameter || "")}
                  {(selectedPair?.rear?.diameter || selectedPair?.front?.diameter) && selectedPair?.rear?.width ? "x" : ""}
                  {fmtSizePart(selectedPair?.rear?.width || "")}
                  {selectedPair?.rear?.offset ? <span className="text-neutral-500"> • ET {String(selectedPair.rear.offset)}</span> : null}
                </div>
              ) : null}
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
      )}

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
          selectToTires ? (
            <button
              type="button"
              onClick={() => selectAndGoToTires()}
              className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-red-700"
            >
              Select wheel
              {pair?.staggered && pair?.rear?.sku ? " (staggered)" : ""}
            </button>
          ) : (
            <Link
              href={viewHref}
              className="rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-red-700"
            >
              View details
            </Link>
          )
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
