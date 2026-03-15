"use client";

import { useMemo, useState } from "react";

type Props = {
  images: string[];
  alt: string;
  note?: string;
};

function uniq(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of arr) {
    const s = String(v || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function ImageGallery({ images, alt, note }: Props) {
  const imgs = useMemo(() => uniq(images || []), [images]);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);

  const current = imgs[idx] || imgs[0] || "";

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={alt}
            className="h-[360px] w-full cursor-zoom-in object-contain"
            loading="lazy"
            onClick={() => setOpen(true)}
          />
        ) : (
          <div className="p-6 text-sm text-neutral-700">Image coming soon</div>
        )}
      </div>

      {note ? <div className="mt-2 text-[11px] text-neutral-500">{note}</div> : null}

      {imgs.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {imgs.map((u, i) => (
            <button
              key={u}
              type="button"
              onClick={() => setIdx(i)}
              className={
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-white " +
                (i === idx ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-300")
              }
              aria-label={`View image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={alt} className="h-full w-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            className="mx-auto flex h-full max-w-5xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full rounded-2xl bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-neutral-600">Zoom</div>
                <button
                  type="button"
                  className="text-xs font-extrabold text-neutral-900 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={current} alt={alt} className="max-h-[75vh] w-full object-contain" />
              </div>

              {imgs.length > 1 ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold"
                    onClick={() => setIdx((v) => (v - 1 + imgs.length) % imgs.length)}
                  >
                    Prev
                  </button>
                  <div className="text-xs text-neutral-600">
                    {idx + 1} / {imgs.length}
                  </div>
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold"
                    onClick={() => setIdx((v) => (v + 1) % imgs.length)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
