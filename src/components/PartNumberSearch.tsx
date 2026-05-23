"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
  type: "wheel" | "tire" | "accessory";
  sku: string;
  name: string;
  brand: string;
  image?: string;
  price?: number;
  url: string;
}

export function PartNumberSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);
  
  // Search when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => res.json())
      .then(data => {
        setResults(data.results || []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);
  
  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    setQuery("");
    router.push(result.url);
  }, [router]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === "Enter" && results.length > 0) {
      handleSelect(results[0]);
    }
  }, [results, handleSelect]);
  
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by part #..."
          className="w-full h-9 pl-9 pr-3 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.sku}`}
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-800 transition-colors text-left"
            >
              {result.image ? (
                <img
                  src={result.image}
                  alt=""
                  className="w-10 h-10 object-contain bg-white rounded"
                />
              ) : (
                <div className="w-10 h-10 bg-neutral-700 rounded flex items-center justify-center text-xs text-neutral-400">
                  {result.type === "wheel" ? "🔘" : "⭕"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{result.name}</div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="uppercase">{result.type}</span>
                  <span>•</span>
                  <span className="font-mono">{result.sku}</span>
                </div>
              </div>
              {result.price && (
                <div className="text-sm font-bold text-green-500">
                  ${result.price.toFixed(2)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* No results message */}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 p-4 text-center text-sm text-neutral-400">
          No products found for "{query}"
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for mobile header
 */
export function PartNumberSearchIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-neutral-400 hover:text-white transition-colors"
      aria-label="Search by part number"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </button>
  );
}
