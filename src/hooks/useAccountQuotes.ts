/**
 * useAccountQuotes Hook
 * 
 * Fetches and manages saved quotes for authenticated users.
 * 
 * Features:
 * - List quotes with loading/error states
 * - Archive (soft delete) quotes
 * - Update quote names
 * - Refresh on demand
 * 
 * @created 2026-08-24
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { SavedQuoteResponse, SavedQuotesListResponse } from "@/lib/savedQuotes/types";

export type { SavedQuoteResponse };

export interface UseAccountQuotesResult {
  quotes: SavedQuoteResponse[];
  isLoading: boolean;
  error: string | null;
  count: number;
  maxQuotes: number;
  refresh: () => Promise<void>;
  archiveQuote: (quoteId: string) => Promise<boolean>;
  renameQuote: (quoteId: string, name: string | null) => Promise<boolean>;
}

export function useAccountQuotes(): UseAccountQuotesResult {
  const [quotes, setQuotes] = useState<SavedQuoteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [maxQuotes, setMaxQuotes] = useState(20);

  const fetchQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/account/quotes");
      
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please sign in to view your quotes");
          return;
        }
        if (res.status === 403) {
          setError("Please verify your email to view quotes");
          return;
        }
        throw new Error("Failed to load quotes");
      }

      const data: SavedQuotesListResponse = await res.json();
      
      setQuotes(data.quotes);
      setCount(data.count);
      setMaxQuotes(data.maxQuotes);
    } catch (err) {
      console.error("[useAccountQuotes] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load quotes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const archiveQuote = useCallback(async (quoteId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/account/quotes/${quoteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to archive quote");
      }

      // Remove from local state immediately
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
      setCount((prev) => Math.max(0, prev - 1));
      
      return true;
    } catch (err) {
      console.error("[useAccountQuotes] Archive error:", err);
      return false;
    }
  }, []);

  const renameQuote = useCallback(async (quoteId: string, name: string | null): Promise<boolean> => {
    try {
      const res = await fetch(`/api/account/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to rename quote");
      }

      // Update local state
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, name } : q))
      );
      
      return true;
    } catch (err) {
      console.error("[useAccountQuotes] Rename error:", err);
      return false;
    }
  }, []);

  return {
    quotes,
    isLoading,
    error,
    count,
    maxQuotes,
    refresh: fetchQuotes,
    archiveQuote,
    renameQuote,
  };
}
