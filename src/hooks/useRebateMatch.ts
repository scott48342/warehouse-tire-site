"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type RebateMatchData = {
  rebateId: string;
  amount: string | null;
  headline: string;
  formUrl: string | null;
  matchType: "sku" | "model" | "brand-wide";
  endsText: string | null;
};

type TireForMatch = {
  sku: string;
  brand: string;
  model: string;
  size: string;
};

type RebateMatchesResult = {
  matches: Record<string, RebateMatchData>;
  loading: boolean;
  error: string | null;
};

// Cache for rebate matches (persists across renders)
const matchesCache = new Map<string, RebateMatchData>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cacheExpiresAt = 0;

function getCacheKey(tire: TireForMatch): string {
  return `${tire.sku}|${tire.brand}|${tire.model}|${tire.size}`.toLowerCase();
}

/**
 * Hook to fetch rebate matches for a batch of tires.
 * Caches results and deduplicates requests.
 */
export function useRebateMatches(tires: TireForMatch[]): RebateMatchesResult {
  const [matches, setMatches] = useState<Record<string, RebateMatchData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!tires.length) return;

    // Clear cache if expired
    if (Date.now() > cacheExpiresAt) {
      matchesCache.clear();
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    }

    // Check cache first
    const cached: Record<string, RebateMatchData> = {};
    const uncached: TireForMatch[] = [];

    for (const tire of tires) {
      if (!tire.sku) continue;
      const key = getCacheKey(tire);
      
      if (matchesCache.has(key)) {
        const match = matchesCache.get(key);
        if (match) cached[tire.sku] = match;
      } else if (!fetchedRef.current.has(key)) {
        uncached.push(tire);
        fetchedRef.current.add(key);
      }
    }

    // Return cached results immediately
    if (Object.keys(cached).length > 0) {
      setMatches(prev => ({ ...prev, ...cached }));
    }

    // Fetch uncached tires
    if (uncached.length === 0) return;

    setLoading(true);
    fetch("/api/rebates/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tires: uncached }),
    })
      .then(res => res.json())
      .then(data => {
        const newMatches = data.matches || {};
        
        // Update cache
        for (const tire of uncached) {
          const key = getCacheKey(tire);
          const match = newMatches[tire.sku];
          if (match) {
            matchesCache.set(key, match);
          }
        }

        setMatches(prev => ({ ...prev, ...newMatches }));
        setError(null);
      })
      .catch(err => {
        console.error("[useRebateMatches] Error:", err);
        setError(err?.message || "Failed to load rebates");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tires.map(t => t.sku).join(",")]);

  return { matches, loading, error };
}

/**
 * Hook to fetch rebate match for a single tire (for PDP).
 */
export function useRebateMatch(tire: TireForMatch | null): {
  match: RebateMatchData | null;
  loading: boolean;
} {
  const [match, setMatch] = useState<RebateMatchData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tire?.sku) {
      setMatch(null);
      return;
    }

    const key = getCacheKey(tire);
    
    // Check cache
    if (Date.now() < cacheExpiresAt && matchesCache.has(key)) {
      setMatch(matchesCache.get(key) || null);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({
      sku: tire.sku,
      brand: tire.brand,
      model: tire.model,
      size: tire.size,
    });

    fetch(`/api/rebates/match?${params}`)
      .then(res => res.json())
      .then(data => {
        const matchData = data.match || null;
        if (matchData) {
          matchesCache.set(key, matchData);
          cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        }
        setMatch(matchData);
      })
      .catch(err => {
        console.error("[useRebateMatch] Error:", err);
        setMatch(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tire?.sku, tire?.brand, tire?.model, tire?.size]);

  return { match, loading };
}
