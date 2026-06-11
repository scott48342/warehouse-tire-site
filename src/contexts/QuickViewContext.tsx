"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { QuickViewModal, type QuickViewData, type QuickViewTireData, type QuickViewWheelData, type QuickViewPackageData } from "@/components/QuickViewModal";
import { trackQuickViewOpen } from "@/lib/analytics/tracker";

// Re-export types for convenience
export type { QuickViewData, QuickViewTireData, QuickViewWheelData, QuickViewPackageData };

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPE
// ═══════════════════════════════════════════════════════════════════════════════

type QuickViewContextType = {
  openQuickView: (data: QuickViewData) => void;
  closeQuickView: () => void;
  isOpen: boolean;
};

const QuickViewContext = createContext<QuickViewContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useQuickView() {
  const context = useContext(QuickViewContext);
  if (!context) {
    throw new Error("useQuickView must be used within a QuickViewProvider");
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function QuickViewProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<QuickViewData | null>(null);

  const openQuickView = useCallback((newData: QuickViewData) => {
    setData(newData);
    setIsOpen(true);
    
    // Track for conversion dashboard
    const type = newData.type as 'wheel' | 'tire' | 'package';
    const sku = (newData as any).sku || (newData as any).wheel?.sku;
    trackQuickViewOpen(type, sku);
  }, []);

  const closeQuickView = useCallback(() => {
    setIsOpen(false);
    // Clear data after animation completes
    setTimeout(() => {
      setData(null);
    }, 200);
  }, []);

  return (
    <QuickViewContext.Provider value={{ openQuickView, closeQuickView, isOpen }}>
      {children}
      <QuickViewModal
        open={isOpen}
        onClose={closeQuickView}
        data={data}
      />
    </QuickViewContext.Provider>
  );
}

export default QuickViewProvider;
