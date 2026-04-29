"use client";

import { useState, useCallback } from "react";

type WheelItem = {
  sku: string;
  brand?: string;
  brandCode?: string;
  model?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  centerbore?: string;
  imageUrl?: string;
  price?: number;
  stockQty?: number;
  inventoryType?: string;
  styleKey?: string;
  fitmentClass?: string;
  finishThumbs?: Array<{ finish: string; imageUrl: string; sku: string }>;
  pair?: any;
  boltPattern?: string;
  fitmentGuidance?: any;
};

type LoadMoreParams = {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
  sort?: string;
  brand_cd?: string;
  finish?: string;
  diameter?: string;
  width?: string;
  style?: string;
  offsetMin?: string;
  offsetMax?: string;
  rearWheelConfig?: string;
};

type Props = {
  initialWheels: WheelItem[];
  totalCount: number;
  batchSize?: number;
  loadMoreParams: LoadMoreParams;
  children: (props: {
    wheels: WheelItem[];
    isLoading: boolean;
    hasMore: boolean;
    loadMore: () => void;
    loadedCount: number;
    totalCount: number;
  }) => React.ReactNode;
};

export function WheelsLazyLoader({
  initialWheels,
  totalCount,
  batchSize = 100,
  loadMoreParams,
  children,
}: Props) {
  const [wheels, setWheels] = useState<WheelItem[]>(initialWheels);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const hasMore = wheels.length < totalCount;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const nextPage = currentPage + 1;
      const params = new URLSearchParams();
      
      // Required params
      params.set("year", loadMoreParams.year);
      params.set("make", loadMoreParams.make);
      params.set("model", loadMoreParams.model);
      params.set("page", String(nextPage));
      params.set("pageSize", String(batchSize));
      
      // Optional params
      if (loadMoreParams.trim) params.set("trim", loadMoreParams.trim);
      if (loadMoreParams.modification) params.set("modification", loadMoreParams.modification);
      if (loadMoreParams.sort) params.set("sort", loadMoreParams.sort);
      if (loadMoreParams.brand_cd) params.set("brand_cd", loadMoreParams.brand_cd);
      if (loadMoreParams.finish) params.set("finish", loadMoreParams.finish);
      if (loadMoreParams.diameter) params.set("diameter", loadMoreParams.diameter);
      if (loadMoreParams.width) params.set("width", loadMoreParams.width);
      if (loadMoreParams.style) params.set("style", loadMoreParams.style);
      if (loadMoreParams.offsetMin) params.set("offsetMin", loadMoreParams.offsetMin);
      if (loadMoreParams.offsetMax) params.set("offsetMax", loadMoreParams.offsetMax);
      if (loadMoreParams.rearWheelConfig) params.set("rearWheelConfig", loadMoreParams.rearWheelConfig);

      const res = await fetch(`/api/wheels/fitment-search?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load more wheels");

      const data = await res.json();
      const newWheels: WheelItem[] = (data.results || []).map((item: any) => ({
        sku: item.sku,
        brand: item.brand,
        brandCode: item.brandCode,
        model: item.model,
        finish: item.finish,
        diameter: item.diameter,
        width: item.width,
        offset: item.offset,
        centerbore: item.centerbore || item.properties?.centerbore,
        imageUrl: item.imageUrl || item.images?.[0]?.imageUrlLarge,
        price: item.price,
        stockQty: item.stockQty,
        inventoryType: item.inventoryType,
        styleKey: item.styleKey,
        fitmentClass: item.fitmentClass,
        finishThumbs: item.finishThumbs,
        pair: item.pair,
        boltPattern: item.boltPattern,
        fitmentGuidance: item.fitmentGuidance,
      }));

      // Dedupe by SKU to avoid duplicates
      setWheels(prev => {
        const existingSkus = new Set(prev.map(w => w.sku));
        const uniqueNew = newWheels.filter(w => !existingSkus.has(w.sku));
        return [...prev, ...uniqueNew];
      });
      setCurrentPage(nextPage);
    } catch (error) {
      console.error("Error loading more wheels:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentPage, batchSize, loadMoreParams]);

  return (
    <>
      {children({
        wheels,
        isLoading,
        hasMore,
        loadMore,
        loadedCount: wheels.length,
        totalCount,
      })}
    </>
  );
}

// Simple Load More button component
export function LoadMoreButton({
  onClick,
  isLoading,
  hasMore,
  loadedCount,
  totalCount,
}: {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
  loadedCount: number;
  totalCount: number;
}) {
  if (!hasMore) return null;

  const remaining = totalCount - loadedCount;

  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <button
        onClick={onClick}
        disabled={isLoading}
        className="rounded-lg bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </span>
        ) : (
          `Load More Wheels (${remaining.toLocaleString()} remaining)`
        )}
      </button>
      <p className="text-xs text-neutral-500">
        Showing {loadedCount.toLocaleString()} of {totalCount.toLocaleString()} wheels
      </p>
    </div>
  );
}
