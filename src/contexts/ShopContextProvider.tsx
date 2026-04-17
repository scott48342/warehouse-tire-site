'use client';

/**
 * Shop Context Provider
 * 
 * Provides shop mode (national/local) context to all components.
 * Detects mode from host/path on mount and provides store selection
 * functionality for local mode.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ShopContext,
  ShopMode,
  LocalStore,
  StoreInfo,
  STORES,
  detectShopContextClient,
  isLocalMode,
  isNationalMode,
  buildLocalOrderMetadata,
  LocalOrderMetadata,
} from '@/lib/shopContext';

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ShopContextValue {
  // Core context
  context: ShopContext;
  mode: ShopMode;
  
  // Mode checks (convenience)
  isNational: boolean;
  isLocal: boolean;
  
  // Local mode state
  selectedStore: LocalStore | undefined;
  storeInfo: StoreInfo | undefined;
  
  // Local mode actions
  selectStore: (store: LocalStore) => void;
  
  // Order helpers
  getLocalOrderMetadata: () => LocalOrderMetadata | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const ShopContextReact = createContext<ShopContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface ShopContextProviderProps {
  children: ReactNode;
  // Optional: pass initial context from server for SSR
  initialContext?: ShopContext;
}

export function ShopContextProvider({ 
  children, 
  initialContext 
}: ShopContextProviderProps) {
  // Initialize with server context or detect client-side
  const [context, setContext] = useState<ShopContext>(() => {
    if (initialContext) return initialContext;
    return detectShopContextClient();
  });
  
  // Separate state for selected store (can be changed by user in local mode)
  const [selectedStore, setSelectedStore] = useState<LocalStore | undefined>(
    context.selectedStore
  );
  
  // Re-detect on mount (handles hydration mismatch)
  useEffect(() => {
    const detected = detectShopContextClient();
    setContext(detected);
    if (detected.selectedStore) {
      setSelectedStore(detected.selectedStore);
    }
  }, []);
  
  // Persist store selection in local mode
  useEffect(() => {
    if (selectedStore && isLocalMode(context)) {
      // Store in localStorage for persistence
      try {
        localStorage.setItem('wt_selected_store', selectedStore);
      } catch {
        // localStorage not available
      }
    }
  }, [selectedStore, context]);
  
  // Load persisted store selection
  useEffect(() => {
    if (isLocalMode(context) && !selectedStore) {
      try {
        const stored = localStorage.getItem('wt_selected_store') as LocalStore | null;
        if (stored && (stored === 'pontiac' || stored === 'waterford')) {
          setSelectedStore(stored);
        }
      } catch {
        // localStorage not available
      }
    }
  }, [context, selectedStore]);
  
  // Store selection handler
  const selectStore = useCallback((store: LocalStore) => {
    if (isLocalMode(context)) {
      setSelectedStore(store);
    }
  }, [context]);
  
  // Get current store info
  const storeInfo = selectedStore ? STORES[selectedStore] : undefined;
  
  // Build local order metadata
  const getLocalOrderMetadata = useCallback((): LocalOrderMetadata | null => {
    if (!isLocalMode(context) || !selectedStore) return null;
    return buildLocalOrderMetadata({
      ...context,
      selectedStore,
      storeInfo: STORES[selectedStore],
    });
  }, [context, selectedStore]);
  
  const value: ShopContextValue = {
    context,
    mode: context.mode,
    isNational: isNationalMode(context),
    isLocal: isLocalMode(context),
    selectedStore,
    storeInfo,
    selectStore,
    getLocalOrderMetadata,
  };
  
  return (
    <ShopContextReact.Provider value={value}>
      {children}
    </ShopContextReact.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Use shop context - throws if not in provider.
 */
export function useShopContext(): ShopContextValue {
  const ctx = useContext(ShopContextReact);
  if (!ctx) {
    throw new Error('useShopContext must be used within ShopContextProvider');
  }
  return ctx;
}

/**
 * Use shop mode only - safe fallback to national.
 */
export function useShopMode(): ShopMode {
  const ctx = useContext(ShopContextReact);
  return ctx?.mode ?? 'national';
}

/**
 * Check if we're in local mode.
 */
export function useIsLocalMode(): boolean {
  const ctx = useContext(ShopContextReact);
  return ctx?.isLocal ?? false;
}

/**
 * Check if we're in national mode.
 */
export function useIsNationalMode(): boolean {
  const ctx = useContext(ShopContextReact);
  return ctx?.isNational ?? true; // Default to national for safety
}

// ═══════════════════════════════════════════════════════════════════════════
// GUARD COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Render children only in local mode.
 * CRITICAL: Use this to guard ALL local-only UI elements.
 */
export function LocalOnly({ children }: { children: ReactNode }) {
  const { isLocal } = useShopContext();
  if (!isLocal) return null;
  return <>{children}</>;
}

/**
 * Render children only in national mode.
 * Use for national-specific messaging that shouldn't appear locally.
 */
export function NationalOnly({ children }: { children: ReactNode }) {
  const { isNational } = useShopContext();
  if (!isNational) return null;
  return <>{children}</>;
}

/**
 * Render different content based on mode.
 */
export function ShopModeSwitch({
  national,
  local,
}: {
  national: ReactNode;
  local: ReactNode;
}) {
  const { isLocal } = useShopContext();
  return <>{isLocal ? local : national}</>;
}
