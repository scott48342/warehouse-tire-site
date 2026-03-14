"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FavoriteItem = {
  type: "wheel" | "tire";
  sku: string;
  label: string;
  href: string;
  imageUrl?: string;
  savedAt: number;
};

const KEY = "wt_favorites";

function readFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as FavoriteItem[]).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeFavorites(items: FavoriteItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    setItems(readFavorites().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)));
  }, []);

  const wheels = useMemo(() => items.filter((x) => x.type === "wheel"), [items]);
  const tires = useMemo(() => items.filter((x) => x.type === "tire"), [items]);

  function remove(it: FavoriteItem) {
    const next = items.filter((x) => !(x.type === it.type && x.sku === it.sku));
    writeFavorites(next);
    setItems(next);
  }

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Favorites</h1>
            <p className="mt-1 text-sm text-neutral-700">Saved in this browser.</p>
          </div>
          <Link href="/" className="text-sm font-extrabold text-neutral-900 hover:underline">
            Home
          </Link>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-extrabold text-neutral-900">Wheels</h2>
            {wheels.length ? (
              <div className="mt-3 grid gap-3">
                {wheels.map((it) => (
                  <div key={`w:${it.sku}`} className="flex items-center justify-between gap-3">
                    <Link href={it.href} className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt={it.label} className="h-14 w-14 object-contain" />
                        ) : (
                          <div className="h-14 w-14 bg-neutral-50" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-neutral-900">{it.label}</div>
                        <div className="text-xs font-semibold text-neutral-600">SKU: {it.sku}</div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(it)}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-neutral-600">No favorite wheels yet.</div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-extrabold text-neutral-900">Tires</h2>
            {tires.length ? (
              <div className="mt-3 grid gap-3">
                {tires.map((it) => (
                  <div key={`t:${it.sku}`} className="flex items-center justify-between gap-3">
                    <Link href={it.href} className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt={it.label} className="h-14 w-14 object-contain" />
                        ) : (
                          <div className="h-14 w-14 bg-neutral-50" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-neutral-900">{it.label}</div>
                        <div className="text-xs font-semibold text-neutral-600">SKU: {it.sku}</div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(it)}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:bg-neutral-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-neutral-600">No favorite tires yet.</div>
            )}
          </section>
        </div>

        <div className="mt-6 text-xs text-neutral-500">
          Next step (optional): make Favorites persistent across devices with accounts.
        </div>
      </div>
    </main>
  );
}
