"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export interface POSVehicle {
  year: string;
  make: string;
  model: string;
  trim?: string;
}

export interface POSWheel {
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  diameter: string;
  width: string;
  offset?: string;
  boltPattern?: string;
  imageUrl?: string;
  unitPrice: number;
  setPrice: number; // qty * unitPrice
  quantity: number;
  fitmentClass?: string;
  tier?: "good" | "better" | "best";
}

export interface POSTire {
  sku: string;
  brand: string;
  model: string;
  size: string;
  imageUrl?: string;
  unitPrice: number;
  setPrice: number;
  quantity: number;
  tier?: "good" | "better" | "best";
}

export interface POSFees {
  labor: number;           // Installation labor
  tpms: number;            // TPMS programming/sensors
  disposal: number;        // Tire disposal fee
  alignment: number;       // Optional alignment
  balancing: number;       // Wheel balancing (usually included in labor)
  custom: { name: string; amount: number }[];
}

export interface POSDiscount {
  type: "percent" | "fixed";
  value: number;
  reason?: string;
}

export type POSStep = "vehicle" | "package" | "pricing" | "quote";

export interface POSState {
  step: POSStep;
  vehicle: POSVehicle | null;
  wheel: POSWheel | null;
  tire: POSTire | null;
  fees: POSFees;
  discount: POSDiscount | null;
  taxRate: number; // e.g., 0.07 for 7%
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FEES: POSFees = {
  labor: 100,        // $100 default labor
  tpms: 0,           // Usually included or $0
  disposal: 20,      // $5/tire = $20
  alignment: 0,      // Optional, $89 typical
  balancing: 0,      // Usually included in labor
  custom: [],
};

const DEFAULT_TAX_RATE = 0.07; // 7% - configurable per location

const initialState: POSState = {
  step: "vehicle",
  vehicle: null,
  wheel: null,
  tire: null,
  fees: DEFAULT_FEES,
  discount: null,
  taxRate: DEFAULT_TAX_RATE,
};

// ============================================================================
// Actions
// ============================================================================

type POSAction =
  | { type: "SET_VEHICLE"; payload: POSVehicle }
  | { type: "SET_WHEEL"; payload: POSWheel }
  | { type: "SET_TIRE"; payload: POSTire }
  | { type: "SET_FEES"; payload: Partial<POSFees> }
  | { type: "SET_DISCOUNT"; payload: POSDiscount | null }
  | { type: "SET_TAX_RATE"; payload: number }
  | { type: "SET_CUSTOMER"; payload: { name?: string; phone?: string; email?: string } }
  | { type: "SET_NOTES"; payload: string }
  | { type: "GO_TO_STEP"; payload: POSStep }
  | { type: "RESET" };

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case "SET_VEHICLE":
      return { 
        ...state, 
        vehicle: action.payload,
        step: "package", // Auto-advance
        // Clear downstream selections when vehicle changes
        wheel: null,
        tire: null,
      };
    
    case "SET_WHEEL":
      return { ...state, wheel: action.payload };
    
    case "SET_TIRE":
      return { 
        ...state, 
        tire: action.payload,
        // Don't auto-advance - let the component handle navigation
      };
    
    case "SET_FEES":
      return { 
        ...state, 
        fees: { ...state.fees, ...action.payload } 
      };
    
    case "SET_DISCOUNT":
      return { ...state, discount: action.payload };
    
    case "SET_TAX_RATE":
      return { ...state, taxRate: action.payload };
    
    case "SET_CUSTOMER":
      return {
        ...state,
        customerName: action.payload.name ?? state.customerName,
        customerPhone: action.payload.phone ?? state.customerPhone,
        customerEmail: action.payload.email ?? state.customerEmail,
      };
    
    case "SET_NOTES":
      return { ...state, notes: action.payload };
    
    case "GO_TO_STEP":
      return { ...state, step: action.payload };
    
    case "RESET":
      return initialState;
    
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface POSContextValue {
  state: POSState;
  
  // Actions
  setVehicle: (vehicle: POSVehicle) => void;
  setWheel: (wheel: POSWheel) => void;
  setTire: (tire: POSTire) => void;
  setFees: (fees: Partial<POSFees>) => void;
  setDiscount: (discount: POSDiscount | null) => void;
  setTaxRate: (rate: number) => void;
  setCustomer: (info: { name?: string; phone?: string; email?: string }) => void;
  setNotes: (notes: string) => void;
  goToStep: (step: POSStep) => void;
  reset: () => void;
  
  // Computed values
  subtotal: number;          // Wheels + Tires
  feesTotal: number;         // All fees
  discountAmount: number;    // Discount value
  taxableAmount: number;     // What gets taxed
  taxAmount: number;         // Tax
  outTheDoorPrice: number;   // Final total
  
  // Helpers
  isComplete: boolean;
  canGenerateQuote: boolean;
}

const POSContext = createContext<POSContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function POSProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(posReducer, initialState);
  
  // Computed: Parts subtotal
  const subtotal = (state.wheel?.setPrice ?? 0) + (state.tire?.setPrice ?? 0);
  
  // Computed: Total fees
  const feesTotal = 
    state.fees.labor +
    state.fees.tpms +
    state.fees.disposal +
    state.fees.alignment +
    state.fees.balancing +
    state.fees.custom.reduce((sum, f) => sum + f.amount, 0);
  
  // Computed: Discount amount
  const discountAmount = state.discount
    ? state.discount.type === "percent"
      ? (subtotal * state.discount.value) / 100
      : state.discount.value
    : 0;
  
  // Taxable = Parts - Discount (labor/fees may or may not be taxed depending on state)
  // For simplicity, we'll tax parts only (most common)
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  
  // Tax amount
  const taxAmount = taxableAmount * state.taxRate;
  
  // Out the door = Parts + Fees - Discount + Tax
  const outTheDoorPrice = subtotal + feesTotal - discountAmount + taxAmount;
  
  // Helpers
  const isComplete = !!(state.vehicle && state.wheel && state.tire);
  const canGenerateQuote = isComplete;
  
  const value: POSContextValue = {
    state,
    
    setVehicle: (vehicle) => dispatch({ type: "SET_VEHICLE", payload: vehicle }),
    setWheel: (wheel) => dispatch({ type: "SET_WHEEL", payload: wheel }),
    setTire: (tire) => dispatch({ type: "SET_TIRE", payload: tire }),
    setFees: (fees) => dispatch({ type: "SET_FEES", payload: fees }),
    setDiscount: (discount) => dispatch({ type: "SET_DISCOUNT", payload: discount }),
    setTaxRate: (rate) => dispatch({ type: "SET_TAX_RATE", payload: rate }),
    setCustomer: (info) => dispatch({ type: "SET_CUSTOMER", payload: info }),
    setNotes: (notes) => dispatch({ type: "SET_NOTES", payload: notes }),
    goToStep: (step) => dispatch({ type: "GO_TO_STEP", payload: step }),
    reset: () => dispatch({ type: "RESET" }),
    
    subtotal,
    feesTotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    outTheDoorPrice,
    
    isComplete,
    canGenerateQuote,
  };
  
  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error("usePOS must be used within a POSProvider");
  }
  return context;
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_FEES, DEFAULT_TAX_RATE };
