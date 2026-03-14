"use client";

import { useEffect, useMemo, useState } from "react";

type FavoriteType = "wheel" | "tire";

type FavoriteItem = {
  type: FavoriteType;
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

export function FavoritesButton({
  type,
  sku,
  label,
  href,
  imageUrl,
}: {
  type: FavoriteType;
  sku: string;
  label: string;
  href: string;
  imageUrl?: string;
}) {
  const [on, setOn] = useState(false);

  const key = useMemo(() => `${type}:${sku}`, [type, sku]);

  useEffect(() => {
    const favs = readFavorites();
    setOn(favs.some((f) => `${f.type}:${f.sku}` === key));
  }, [key]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const favs = readFavorites();
        const exists = favs.some((f) => `${f.type}:${f.sku}` === key);
        const next = exists
          ? favs.filter((f) => `${f.type}:${f.sku}` !== key)
          : [
              {
                type,
                sku,
                label,
                href,
                imageUrl,
                savedAt: Date.now(),
              },
              ...favs,
            ];
        writeFavorites(next);
        setOn(!exists);
      }}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-extrabold " +
        (on
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50")
      }
      aria-pressed={on}
      title={on ? "Remove from favorites" : "Add to favorites"}
    >
      {on ? "♥" : "♡"}
    </button>
  );
}

export type { FavoriteItem };
export function getFavorites(): FavoriteItem[] {
  return readFavorites();
}
