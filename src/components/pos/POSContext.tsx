"use client";

import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";

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
  labor: number;           // Installation labor (mount & balance)
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

// Admin settings - stored in localStorage
export interface POSAdminSettings {
  // Labor pricing (per wheel)
  laborPerWheel: number;
  
  // Add-ons
  tpmsPerSensor: number;
  disposalPerTire: number;
  alignmentPrice: number;
  
  // Credit card fee
  creditCardFeePercent: number; // e.g., 3.99 for 3.99%
  
  // Custom add-ons that can be toggled
  customAddOns: Array<{
    id: string;
    name: string;
    price: number;
    perUnit: boolean; // true = per wheel/tire, false = flat fee
  }>;
}

export type POSStep = "vehicle" | "package" | "pricing" | "quote";

export interface POSState {
  step: POSStep;
  vehicle: POSVehicle | null;
  wheel: POSWheel | null;
  tire: POSTire | null;
  fees: POSFees;
  discount: POSDiscount | null;
  taxRate: number; // Fixed at 6% (0.06)
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  notes?: string;
  
  // Admin settings
  adminSettings: POSAdminSettings;
  showAdminPanel: boolean;
  
  // Selected add-ons for current quote
  selectedAddOns: {
    labor: boolean;
    tpms: boolean;
    disposal: boolean;
    alignment: boolean;
    creditCard: boolean; // Credit card processing fee
    customIds: string[];
  };
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_ADMIN_SETTINGS: POSAdminSettings = {
  laborPerWheel: 25,        // $25/wheel = $100 for set of 4
  tpmsPerSensor: 15,        // $15/sensor = $60 for set of 4
  disposalPerTire: 5,       // $5/tire = $20 for set of 4
  alignmentPrice: 89,       // Flat $89 alignment
  creditCardFeePercent: 3.99, // 3.99% credit card processing fee
  customAddOns: [
    { id: "lugnuts", name: "Lug Nuts (set)", price: 40, perUnit: false },
    { id: "hubcentric", name: "Hub Centric Rings", price: 30, perUnit: false },
    { id: "valvestems", name: "Valve Stems", price: 20, perUnit: false },
  ],
};

const DEFAULT_FEES: POSFees = {
  labor: 100,        // $100 default labor
  tpms: 0,           // Usually included or $0
  disposal: 20,      // $5/tire = $20
  alignment: 0,      // Optional, $89 typical
  balancing: 0,      // Usually included in labor
  custom: [],
};

// Tax rate is FIXED at 6% per Scott's request
const FIXED_TAX_RATE = 0.06;

const DEFAULT_SELECTED_ADDONS = {
  labor: true,      // Labor on by default
  tpms: false,
  disposal: true,   // Disposal on by default
  alignment: false,
  creditCard: false, // Off by default (cash/check)
  customIds: [],
};

const initialState: POSState = {
  step: "vehicle",
  vehicle: null,
  wheel: null,
  tire: null,
  fees: DEFAULT_FEES,
  discount: null,
  taxRate: FIXED_TAX_RATE,
  adminSettings: DEFAULT_ADMIN_SETTINGS,
  showAdminPanel: false,
  selectedAddOns: DEFAULT_SELECTED_ADDONS,
};

// ============================================================================
// LocalStorage Keys
// ============================================================================

const ADMIN_SETTINGS_KEY = "pos_admin_settings";

function loadAdminSettings(): POSAdminSettings {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS;
  try {
    const stored = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("[POS] Failed to load admin settings:", e);
  }
  return DEFAULT_ADMIN_SETTINGS;
}

function saveAdminSettings(settings: POSAdminSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn("[POS] Failed to save admin settings:", e);
  }
}

// ============================================================================
// Actions
// ============================================================================

type POSAction =
  | { type: "SET_VEHICLE"; payload: POSVehicle }
  | { type: "SET_WHEEL"; payload: POSWheel }
  | { type: "SET_TIRE"; payload: POSTire }
  | { type: "SET_FEES"; payload: Partial<POSFees> }
  | { type: "SET_DISCOUNT"; payload: POSDiscount | null }
  | { type: "SET_CUSTOMER"; payload: { name?: string; phone?: string; email?: string } }
  | { type: "SET_NOTES"; payload: string }
  | { type: "GO_TO_STEP"; payload: POSStep }
  | { type: "RESET" }
  | { type: "SET_ADMIN_SETTINGS"; payload: Partial<POSAdminSettings> }
  | { type: "TOGGLE_ADMIN_PANEL" }
  | { type: "SET_SELECTED_ADDONS"; payload: Partial<POSState["selectedAddOns"]> }
  | { type: "LOAD_ADMIN_SETTINGS"; payload: POSAdminSettings };

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case "SET_VEHICLE":
      return { 
        ...state, 
        vehicle: action.payload,
        step: "package",
        wheel: null,
        tire: null,
      };
    
    case "SET_WHEEL":
      return { ...state, wheel: action.payload };
    
    case "SET_TIRE":
      return { ...state, tire: action.payload };
    
    case "SET_FEES":
      return { 
        ...state, 
        fees: { ...state.fees, ...action.payload } 
      };
    
    case "SET_DISCOUNT":
      return { ...state, discount: action.payload };
    
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
      return {
        ...initialState,
        adminSettings: state.adminSettings, // Preserve admin settings
        selectedAddOns: DEFAULT_SELECTED_ADDONS,
      };
    
    case "SET_ADMIN_SETTINGS": {
      const newSettings = { ...state.adminSettings, ...action.payload };
      saveAdminSettings(newSettings);
      return { ...state, adminSettings: newSettings };
    }
    
    case "LOAD_ADMIN_SETTINGS":
      return { ...state, adminSettings: action.payload };
    
    case "TOGGLE_ADMIN_PANEL":
      return { ...state, showAdminPanel: !state.showAdminPanel };
    
    case "SET_SELECTED_ADDONS":
      return {
        ...state,
        selectedAddOns: { ...state.selectedAddOns, ...action.payload },
      };
    
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
  setCustomer: (info: { name?: string; phone?: string; email?: string }) => void;
  setNotes: (notes: string) => void;
  goToStep: (step: POSStep) => void;
  reset: () => void;
  
  // Admin
  setAdminSettings: (settings: Partial<POSAdminSettings>) => void;
  toggleAdminPanel: () => void;
  setSelectedAddOns: (addons: Partial<POSState["selectedAddOns"]>) => void;
  
  // Computed values
  subtotal: number;          // Wheels + Tires
  laborTotal: number;        // Labor fees
  addOnsTotal: number;       // All add-ons
  discountAmount: number;    // Discount value
  taxableAmount: number;     // What gets taxed
  taxAmount: number;         // Tax
  creditCardFee: number;     // Credit card processing fee
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
  
  // Load admin settings from localStorage on mount
  useEffect(() => {
    const settings = loadAdminSettings();
    dispatch({ type: "LOAD_ADMIN_SETTINGS", payload: settings });
  }, []);
  
  // Computed: Parts subtotal
  const subtotal = (state.wheel?.setPrice ?? 0) + (state.tire?.setPrice ?? 0);
  
  // Computed: Labor total
  const laborTotal = state.selectedAddOns.labor 
    ? state.adminSettings.laborPerWheel * 4 
    : 0;
  
  // Computed: Add-ons total
  const addOnsTotal = (() => {
    let total = 0;
    
    if (state.selectedAddOns.tpms) {
      total += state.adminSettings.tpmsPerSensor * 4;
    }
    if (state.selectedAddOns.disposal) {
      total += state.adminSettings.disposalPerTire * 4;
    }
    if (state.selectedAddOns.alignment) {
      total += state.adminSettings.alignmentPrice;
    }
    
    // Custom add-ons
    for (const addon of state.adminSettings.customAddOns) {
      if (state.selectedAddOns.customIds.includes(addon.id)) {
        total += addon.perUnit ? addon.price * 4 : addon.price;
      }
    }
    
    return total;
  })();
  
  // Computed: Discount amount
  const discountAmount = state.discount
    ? state.discount.type === "percent"
      ? (subtotal * state.discount.value) / 100
      : state.discount.value
    : 0;
  
  // Taxable = Parts - Discount (labor/fees usually not taxed in MI)
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  
  // Tax amount (fixed 6%)
  const taxAmount = taxableAmount * FIXED_TAX_RATE;
  
  // Subtotal after tax (before credit card fee)
  const subtotalAfterTax = subtotal + laborTotal + addOnsTotal - discountAmount + taxAmount;
  
  // Credit card fee (applied to total if paying by card)
  const creditCardFee = state.selectedAddOns.creditCard
    ? subtotalAfterTax * (state.adminSettings.creditCardFeePercent / 100)
    : 0;
  
  // Out the door = Parts + Labor + AddOns - Discount + Tax + CC Fee
  const outTheDoorPrice = subtotalAfterTax + creditCardFee;
  
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
    setCustomer: (info) => dispatch({ type: "SET_CUSTOMER", payload: info }),
    setNotes: (notes) => dispatch({ type: "SET_NOTES", payload: notes }),
    goToStep: (step) => dispatch({ type: "GO_TO_STEP", payload: step }),
    reset: () => dispatch({ type: "RESET" }),
    
    setAdminSettings: (settings) => dispatch({ type: "SET_ADMIN_SETTINGS", payload: settings }),
    toggleAdminPanel: () => dispatch({ type: "TOGGLE_ADMIN_PANEL" }),
    setSelectedAddOns: (addons) => dispatch({ type: "SET_SELECTED_ADDONS", payload: addons }),
    
    subtotal,
    laborTotal,
    addOnsTotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    creditCardFee,
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

export { DEFAULT_FEES, FIXED_TAX_RATE, DEFAULT_ADMIN_SETTINGS };
