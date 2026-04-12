"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CompareItemType = "wheel" | "tire";

export type CompareItem = {
  id: string;
  type: CompareItemType;
  brand: string;
  model: string;
  finish?: string;
  imageUrl?: string;
  priceEach?: number;
  priceSet?: number;
  compareData: {
    // Wheel-specific
    diameter?: string;
    width?: string;
    offset?: string;
    boltPattern?: string;
    centerBore?: string;
    fitmentLevel?: string;
    stockStatus?: string;
    loadRating?: string;
    weight?: string;
    inventoryType?: string;
    // Tire-specific
    size?: string;
    aspectRatio?: string;
    loadIndex?: string;
    speedRating?: string;
    loadRange?: string;
    treadwear?: string;
    traction?: string;
    temperature?: string;
    category?: string;
    mileageWarranty?: string;
    is3PMSF?: boolean;
    isXL?: boolean;
    isRunFlat?: boolean;
    overallDiameter?: string;
    sectionWidth?: string;
    source?: string;
  };
  addedAt: number;
};

type CompareState = {
  items: CompareItem[];
  activeType: CompareItemType | null;
};

type CompareContextValue = {
  items: CompareItem[];
  activeType: CompareItemType | null;
  itemCount: number;
  isInCompare: (id: string) => boolean;
  canAdd: (type: CompareItemType) => boolean;
  addItem: (item: CompareItem) => boolean;
  removeItem: (id: string) => void;
  clearAll: () => void;
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_COMPARE_ITEMS = 4;
const STORAGE_KEY = "wtd_compare";

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const CompareContext = createContext<CompareContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE HELPERS (SSR-safe)
// ═══════════════════════════════════════════════════════════════════════════════

function loadFromStorage(): CompareState {
  if (typeof window === "undefined") {
    return { items: [], activeType: null };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { items: [], activeType: null };
    
    const parsed = JSON.parse(stored) as CompareState;
    
    // Validate structure
    if (!Array.isArray(parsed.items)) {
      return { items: [], activeType: null };
    }
    
    // Filter out any invalid items
    const validItems = parsed.items.filter(
      (item): item is CompareItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        (item.type === "wheel" || item.type === "tire") &&
        typeof item.brand === "string" &&
        typeof item.model === "string"
    );
    
    // Recalculate activeType from items
    const activeType = validItems.length > 0 ? validItems[0].type : null;
    
    return { items: validItems, activeType };
  } catch (err) {
    console.warn("[CompareContext] Failed to load from storage:", err);
    return { items: [], activeType: null };
  }
}

function saveToStorage(state: CompareState): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[CompareContext] Failed to save to storage:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function CompareProvider({ children }: { children: ReactNode }) {
  // Initialize with empty state (will hydrate from localStorage in useEffect)
  const [state, setState] = useState<CompareState>({
    items: [],
    activeType: null,
  });
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    const stored = loadFromStorage();
    setState(stored);
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on state change (after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveToStorage(state);
    }
  }, [state, isHydrated]);

  // Check if an item is already in compare
  const isInCompare = useCallback(
    (id: string): boolean => {
      return state.items.some((item) => item.id === id);
    },
    [state.items]
  );

  // Check if we can add an item of a given type
  const canAdd = useCallback(
    (type: CompareItemType): boolean => {
      // Can't add if at max
      if (state.items.length >= MAX_COMPARE_ITEMS) return false;
      
      // Can't add if activeType is set and doesn't match
      if (state.activeType !== null && state.activeType !== type) return false;
      
      return true;
    },
    [state.items.length, state.activeType]
  );

  // Add an item to compare
  const addItem = useCallback(
    (item: CompareItem): boolean => {
      // Check for duplicate
      if (isInCompare(item.id)) {
        console.warn("[CompareContext] Item already in compare:", item.id);
        return false;
      }

      // Check max limit
      if (state.items.length >= MAX_COMPARE_ITEMS) {
        console.warn("[CompareContext] Max items reached:", MAX_COMPARE_ITEMS);
        return false;
      }

      // Check type mismatch
      if (state.activeType !== null && state.activeType !== item.type) {
        console.warn(
          "[CompareContext] Type mismatch. Active:",
          state.activeType,
          "Attempted:",
          item.type
        );
        return false;
      }

      setState((prev) => ({
        items: [...prev.items, { ...item, addedAt: Date.now() }],
        activeType: item.type,
      }));

      return true;
    },
    [state.items.length, state.activeType, isInCompare]
  );

  // Remove an item from compare
  const removeItem = useCallback((id: string): void => {
    setState((prev) => {
      const newItems = prev.items.filter((item) => item.id !== id);
      return {
        items: newItems,
        activeType: newItems.length > 0 ? newItems[0].type : null,
      };
    });
  }, []);

  // Clear all items
  const clearAll = useCallback((): void => {
    setState({ items: [], activeType: null });
    setIsPanelOpen(false);
  }, []);

  // Panel controls
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const togglePanel = useCallback(() => setIsPanelOpen((prev) => !prev), []);

  const value = useMemo<CompareContextValue>(
    () => ({
      items: state.items,
      activeType: state.activeType,
      itemCount: state.items.length,
      isInCompare,
      canAdd,
      addItem,
      removeItem,
      clearAll,
      isPanelOpen,
      openPanel,
      closePanel,
      togglePanel,
    }),
    [
      state.items,
      state.activeType,
      isInCompare,
      canAdd,
      addItem,
      removeItem,
      clearAll,
      isPanelOpen,
      openPanel,
      closePanel,
      togglePanel,
    ]
  );

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useCompare(): CompareContextValue {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a wheel product into a CompareItem.
 * Extracts only the fields needed for comparison.
 */
export function normalizeWheelForCompare(product: {
  sku?: string;
  brand?: string;
  model?: string;
  finish?: string;
  imageUrl?: string;
  price?: number;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  centerbore?: string;
  fitmentClass?: string;
  stockQty?: number;
  inventoryType?: string;
  loadRating?: string;
  weight?: string;
}): CompareItem {
  const priceEach = typeof product.price === "number" ? product.price : undefined;
  const priceSet = priceEach !== undefined ? priceEach * 4 : undefined;

  // Determine stock status from qty or inventory type
  let stockStatus: string | undefined;
  if (typeof product.stockQty === "number" && product.stockQty > 0) {
    stockStatus = product.stockQty >= 20 ? "20+ in stock" : `${product.stockQty} in stock`;
  } else if (product.inventoryType) {
    const typeLabels: Record<string, string> = {
      ST: "In Stock",
      BW: "In Stock",
      NW: "In Stock",
      SO: "Special Order",
      CS: "Custom Build",
      DB: "Available",
      N2: "Ships Soon",
      RW: "Special Order",
    };
    stockStatus = typeLabels[product.inventoryType] || product.inventoryType;
  }

  // Map fitment class to friendly label
  const fitmentLabels: Record<string, string> = {
    surefit: "Guaranteed Fit",
    specfit: "Good Fit",
    extended: "Custom Fit",
  };
  const fitmentLevel = product.fitmentClass
    ? fitmentLabels[product.fitmentClass] || product.fitmentClass
    : undefined;

  return {
    id: product.sku || `wheel-${Date.now()}`,
    type: "wheel",
    brand: product.brand || "Unknown",
    model: product.model || "Unknown",
    finish: product.finish,
    imageUrl: product.imageUrl,
    priceEach,
    priceSet,
    compareData: {
      diameter: product.diameter,
      width: product.width,
      offset: product.offset,
      boltPattern: product.boltPattern,
      centerBore: product.centerbore,
      fitmentLevel,
      stockStatus,
      loadRating: product.loadRating,
      weight: product.weight,
      inventoryType: product.inventoryType,
    },
    addedAt: Date.now(),
  };
}

/**
 * Normalize a tire product into a CompareItem.
 * Extracts only the fields needed for comparison.
 */
export function normalizeTireForCompare(product: {
  sku?: string;
  partNumber?: string;
  mfgPartNumber?: string;
  brand?: string;
  model?: string;
  displayName?: string;
  imageUrl?: string;
  price?: number;
  size?: string;
  width?: string;
  aspectRatio?: string;
  diameter?: string;
  loadIndex?: string;
  speedRating?: string;
  loadRange?: string;
  treadwear?: string | number;
  traction?: string;
  temperature?: string;
  category?: string;
  mileageWarranty?: number;
  is3PMSF?: boolean;
  isXL?: boolean;
  isRunFlat?: boolean;
  overallDiameter?: string | number;
  sectionWidth?: string | number;
  stockQty?: number;
  source?: string;
}): CompareItem {
  const priceEach = typeof product.price === "number" ? product.price : undefined;
  const priceSet = priceEach !== undefined ? priceEach * 4 : undefined;

  // Determine stock status
  let stockStatus: string | undefined;
  if (typeof product.stockQty === "number" && product.stockQty > 0) {
    stockStatus = product.stockQty >= 20 ? "20+ in stock" : `${product.stockQty} in stock`;
  }

  // Format mileage warranty
  let mileageWarranty: string | undefined;
  if (typeof product.mileageWarranty === "number" && product.mileageWarranty > 0) {
    mileageWarranty = `${Math.round(product.mileageWarranty / 1000)}K miles`;
  }

  // Format treadwear
  let treadwear: string | undefined;
  if (product.treadwear !== undefined && product.treadwear !== null) {
    treadwear = String(product.treadwear);
  }

  // Format overall diameter
  let overallDiameter: string | undefined;
  if (product.overallDiameter !== undefined && product.overallDiameter !== null) {
    overallDiameter = `${product.overallDiameter}"`;
  }

  // Format section width
  let sectionWidth: string | undefined;
  if (product.sectionWidth !== undefined && product.sectionWidth !== null) {
    sectionWidth = `${product.sectionWidth}mm`;
  }

  // Determine ID - prefer mfgPartNumber, then partNumber, then sku
  const id = product.mfgPartNumber || product.partNumber || product.sku || `tire-${Date.now()}`;

  return {
    id,
    type: "tire",
    brand: product.brand || "Unknown",
    model: product.model || product.displayName || "Unknown",
    imageUrl: product.imageUrl,
    priceEach,
    priceSet,
    compareData: {
      size: product.size,
      width: product.width,
      aspectRatio: product.aspectRatio,
      diameter: product.diameter,
      loadIndex: product.loadIndex,
      speedRating: product.speedRating,
      loadRange: product.loadRange,
      treadwear,
      traction: product.traction,
      temperature: product.temperature,
      category: product.category,
      mileageWarranty,
      is3PMSF: product.is3PMSF,
      isXL: product.isXL,
      isRunFlat: product.isRunFlat,
      overallDiameter,
      sectionWidth,
      stockStatus,
      source: product.source,
    },
    addedAt: Date.now(),
  };
}
