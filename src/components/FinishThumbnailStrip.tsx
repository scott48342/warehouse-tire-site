"use client";

import { useRouter } from "next/navigation";

export type FinishThumb = {
  finish: string;
  sku: string;
  imageUrl?: string;
};

export function FinishThumbnailStrip({
  items,
  selectedFinish,
}: {
  items: FinishThumb[];
  selectedFinish?: string;
}) {
  const router = useRouter();
  if (!items?.length) return null;

  return (
    <div className="mt-3">
      <div className="text-xs font-extrabold text-neutral-900">Finish</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => {
          const active = !!selectedFinish && it.finish === selectedFinish;
          return (
            <button
              key={`${it.finish}-${it.sku}`}
              type="button"
              onClick={() => router.push(`/wheels/${encodeURIComponent(it.sku)}`)}
              className={
                "flex items-center gap-2 rounded-xl border px-2 py-1 text-left text-xs font-semibold " +
                (active
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300")
              }
              aria-pressed={active}
              title={it.finish}
            >
              {it.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.imageUrl}
                  alt={it.finish}
                  className={
                    "h-8 w-8 rounded-lg border object-contain " +
                    (active ? "border-neutral-900 bg-white" : "border-neutral-200 bg-white")
                  }
                  loading="lazy"
                />
              ) : (
                <span
                  className={
                    "h-8 w-8 rounded-lg border " +
                    (active ? "border-neutral-900 bg-white" : "border-neutral-200 bg-neutral-50")
                  }
                />
              )}
              <span className="max-w-[180px] truncate">{it.finish}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
