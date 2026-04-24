"use client";

import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";
import {
  type StaggeredFitmentInfo,
  type SetupMode,
  type SelectedWheelWithStaggered,
  type SelectedTireWithStaggered,
  supportsStaggeredFitment,
  getDefaultSetupMode,
} from "@/lib/fitment/staggeredFitment";
import { detectVehicleType } from "@/lib/aftermarketFitment";

// ============================================================================
// Types
// ============================================================================

export interface POSVehicle {
  year: string;
  make: string;
  model: string;
  trim?: string;
}

// Build type for lifted/leveled/stock configurations
export type POSBuildType = "stock" | "leveled" | "lifted";

// Re-export shared types for convenience
export type { StaggeredFitmentInfo, SetupMode };

// Lift configuration for leveled/lifted builds
export interface POSLiftConfig {
  liftInches: number;
  targetTireSize?: number;
  presetId?: "daily" | "offroad" | "extreme";
  offsetMin?: number;
  offsetMax?: number;
  notes?: string[];
}

// POS Wheel - extends shared SelectedWheelWithStaggered with POS-specific fields
export interface POSWheel extends SelectedWheelWithStaggered {
  quantity: number;        // Always 4 (2 front + 2 rear, or 4 same)
  tier?: "good" | "better" | "best";
}

// POS Tire - extends shared SelectedTireWithStaggered with POS-specific fields
export interface POSTire extends SelectedTireWithStaggered {
  quantity: number;        // Always 4
  tier?: "good" | "better" | "best";
  loadIndex?: string;
  speedRating?: string;
}

export interface POSFees {
  labor: number;
  tpms: number;
  disposal: number;
  alignment: number;
  balancing: number;
  custom: { name: string; amount: number }[];
}

export interface POSDiscount {
  type: "percent" | "fixed";
  value: number;
  reason?: string;
}

// Admin settings - stored in localStorage
export interface POSAdminSettings {
  laborPerWheel: number;
  tpmsPerSensor: number;
  disposalPerTire: number;
  alignmentPrice: number;
  liftInstallLabor: {
    level: number;
    lift2to3: number;
    lift4to6: number;
    lift8plus: number;
  };
  creditCardFeePercent: number;
  customAddOns: Array<{
    id: string;
    name: string;
    price: number;
    perUnit: boolean;
  }>;
}

export type POSStep = "vehicle" | "build-type" | "package" | "pricing" | "quote";

export interface POSState {
  step: POSStep;
  vehicle: POSVehicle | null;
  
  // Build configuration
  buildType: POSBuildType;
  liftConfig: POSLiftConfig | null;
  
  // Staggered fitment - uses shared types
  setupMode: SetupMode;
  staggeredInfo: StaggeredFitmentInfo | null;
  
  // Wheel and Tire - single objects with optional rear fields (retail pattern)
  wheel: POSWheel | null;
  tire: POSTire | null;
  
  fees: POSFees;
  discount: POSDiscount | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  adminSettings: POSAdminSettings;
  showAdminPanel: boolean;
  selectedAddOns: {
    labor: boolean;
    tpms: boolean;
    disposal: boolean;
    alignment: boolean;
    liftInstall: boolean;
    creditCard: boolean;
    customIds: string[];
  };
}

type POSAction =
  | { type: "SET_VEHICLE"; payload: POSVehicle | null }
  | { type: "SET_BUILD_TYPE"; payload: { buildType: POSBuildType; liftConfig?: POSLiftConfig | null } }
  | { type: "SET_STAGGERED_INFO"; payload: { staggeredInfo: StaggeredFitmentInfo | null } }
  | { type: "SET_SETUP_MODE"; payload: SetupMode }
  | { type: "SET_WHEEL"; payload: POSWheel | null }
  | { type: "SET_TIRE"; payload: POSTire | null }
  | { type: "SET_FEES"; payload: Partial<POSFees> }
  | { type: "SET_DISCOUNT"; payload: POSDiscount | null }
  | { type: "SET_CUSTOMER"; payload: { name?: string; phone?: string; email?: string } }
  | { type: "SET_NOTES"; payload: string }
  | { type: "GO_TO_STEP"; payload: POSStep }
  | { type: "RESET" }
  | { type: "LOAD_ADMIN_SETTINGS"; payload: POSAdminSettings }
  | { type: "SET_ADMIN_SETTINGS"; payload: Partial<POSAdminSettings> }
  | { type: "TOGGLE_ADMIN_PANEL" }
  | { type: "SET_SELECTED_ADDONS"; payload: Partial<POSState["selectedAddOns"]> };

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_FEES: POSFees = {
  labor: 0,
  tpms: 0,
  disposal: 0,
  alignment: 0,
  balancing: 0,
  custom: [],
};

export const FIXED_TAX_RATE = 0.06; // 6% Michigan sales tax

export const DEFAULT_ADMIN_SETTINGS: POSAdminSettings = {
  laborPerWheel: 25,
  tpmsPerSensor: 50,
  disposalPerTire: 5,
  alignmentPrice: 99,
  liftInstallLabor: {
    level: 150,
    lift2to3: 350,
    lift4to6: 650,
    lift8plus: 1200,
  },
  creditCardFeePercent: 3.5,
  customAddOns: [],
};

const DEFAULT_SELECTED_ADDONS = {
  labor: true,
  tpms: false,
  disposal: true,
  alignment: false,
  liftInstall: false,
  creditCard: false,
  customIds: [],
};

// ============================================================================
// LocalStorage Helpers
// ============================================================================

const ADMIN_SETTINGS_KEY = "pos_admin_settings";

function loadAdminSettings(): POSAdminSettings {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SETTINGS;
  try {
    const saved = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_ADMIN_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error("Failed to load admin settings:", e);
  }
  return DEFAULT_ADMIN_SETTINGS;
}

function saveAdminSettings(settings: POSAdminSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save admin settings:", e);
  }
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: POSState = {
  step: "vehicle",
  vehicle: null,
  buildType: "stock",
  liftConfig: null,
  setupMode: "square",
  staggeredInfo: null,
  wheel: null,
  tire: null,
  fees: DEFAULT_FEES,
  discount: null,
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  notes: "",
  adminSettings: DEFAULT_ADMIN_SETTINGS,
  showAdminPanel: false,
  selectedAddOns: DEFAULT_SELECTED_ADDONS,
};

// ============================================================================
// Reducer
// ============================================================================

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case "SET_VEHICLE": {
      // Determine if vehicle can be lifted (trucks/SUVs only)
      const vehicleType = action.payload 
        ? detectVehicleType(action.payload.model)
        : "car";
      const isLiftable = vehicleType === "truck" || vehicleType === "suv";
      
      // Skip build-type step for cars (they can't be lifted/leveled)
      const nextStep = action.payload 
        ? (isLiftable ? "build-type" : "package")
        : "vehicle";
      
      return {
        ...state,
        vehicle: action.payload,
        step: nextStep,
        // Reset downstream when vehicle changes
        buildType: "stock",
        liftConfig: null,
        setupMode: "square",
        staggeredInfo: null,
        wheel: null,
        tire: null,
      };
    }

    case "SET_BUILD_TYPE":
      return {
        ...state,
        buildType: action.payload.buildType,
        liftConfig: action.payload.liftConfig ?? null,
        // Enable lift install add-on for non-stock builds
        selectedAddOns: {
          ...state.selectedAddOns,
          liftInstall: action.payload.buildType !== "stock",
        },
      };

    case "SET_STAGGERED_INFO": {
      const info = action.payload.staggeredInfo;
      const supportsStaggered = supportsStaggeredFitment(info);
      return {
        ...state,
        staggeredInfo: info,
        // Default to staggered mode if vehicle supports it
        setupMode: supportsStaggered ? getDefaultSetupMode(info) : "square",
      };
    }

    case "SET_SETUP_MODE":
      return {
        ...state,
        setupMode: action.payload,
        // Clear wheel/tire when mode changes (may need different selection)
        wheel: null,
        tire: null,
      };

    case "SET_WHEEL":
      return { ...state, wheel: action.payload };

    case "SET_TIRE":
      return { ...state, tire: action.payload };

    case "SET_FEES":
      return { ...state, fees: { ...state.fees, ...action.payload } };

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
        adminSettings: state.adminSettings,
      };

    case "LOAD_ADMIN_SETTINGS":
      return { ...state, adminSettings: action.payload };

    case "SET_ADMIN_SETTINGS": {
      const newSettings = { ...state.adminSettings, ...action.payload };
      saveAdminSettings(newSettings);
      return { ...state, adminSettings: newSettings };
    }

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
  
  // Vehicle & Build
  setVehicle: (vehicle: POSVehicle | null) => void;
  setBuildType: (buildType: POSBuildType, liftConfig?: POSLiftConfig | null) => void;
  
  // Staggered Fitment - uses shared module
  setStaggeredInfo: (staggeredInfo: StaggeredFitmentInfo | null) => void;
  setSetupMode: (mode: SetupMode) => void;
  isStaggered: boolean;  // Computed: setupMode === "staggered"
  supportsStaggered: boolean;  // Computed: staggeredInfo?.isStaggered
  
  // Wheel & Tire - single objects with optional rear fields
  setWheel: (wheel: POSWheel | null) => void;
  setTire: (tire: POSTire | null) => void;
  
  // Fees & Discount
  setFees: (fees: Partial<POSFees>) => void;
  setDiscount: (discount: POSDiscount | null) => void;
  
  // Customer & Notes
  setCustomer: (info: { name?: string; phone?: string; email?: string }) => void;
  setNotes: (notes: string) => void;
  
  // Navigation
  goToStep: (step: POSStep) => void;
  reset: () => void;
  
  // Admin
  setAdminSettings: (settings: Partial<POSAdminSettings>) => void;
  toggleAdminPanel: () => void;
  setSelectedAddOns: (addons: Partial<POSState["selectedAddOns"]>) => void;
  
  // Computed pricing
  subtotal: number;
  wheelsTotal: number;
  tiresTotal: number;
  laborTotal: number;
  liftInstallTotal: number;
  addOnsTotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  creditCardFee: number;
  outTheDoorPrice: number;
  
  // Computed state
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

  // Computed: Is staggered mode active
  const isStaggered = state.setupMode === "staggered";
  
  // Computed: Does vehicle support staggered
  const supportsStaggered = supportsStaggeredFitment(state.staggeredInfo);

  // Computed: Wheels total (setPrice already includes all 4)
  const wheelsTotal = state.wheel?.setPrice ?? 0;

  // Computed: Tires total (setPrice already includes all 4)
  const tiresTotal = state.tire?.setPrice ?? 0;

  // Computed: Parts subtotal
  const subtotal = wheelsTotal + tiresTotal;

  // Computed: Labor total
  const laborTotal = state.selectedAddOns.labor
    ? state.adminSettings.laborPerWheel * 4
    : 0;

  // Computed: Lift install labor
  const liftInstallTotal = (() => {
    if (!state.selectedAddOns.liftInstall || !state.liftConfig) return 0;
    const { liftInches } = state.liftConfig;
    const { liftInstallLabor } = state.adminSettings;
    if (state.buildType === "leveled" || liftInches <= 2) return liftInstallLabor.level;
    if (liftInches <= 3) return liftInstallLabor.lift2to3;
    if (liftInches <= 6) return liftInstallLabor.lift4to6;
    return liftInstallLabor.lift8plus;
  })();

  // Computed: Add-ons total
  const addOnsTotal = (() => {
    let total = 0;
    if (state.selectedAddOns.tpms) total += state.adminSettings.tpmsPerSensor * 4;
    if (state.selectedAddOns.disposal) total += state.adminSettings.disposalPerTire * 4;
    if (state.selectedAddOns.alignment) total += state.adminSettings.alignmentPrice;
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

  // Taxable = Parts - Discount
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Tax amount (fixed 6%)
  const taxAmount = taxableAmount * FIXED_TAX_RATE;

  // Subtotal after tax
  const subtotalAfterTax = subtotal + laborTotal + liftInstallTotal + addOnsTotal - discountAmount + taxAmount;

  // Credit card fee
  const creditCardFee = state.selectedAddOns.creditCard
    ? subtotalAfterTax * (state.adminSettings.creditCardFeePercent / 100)
    : 0;

  // Out the door price
  const outTheDoorPrice = subtotalAfterTax + creditCardFee;

  // Computed: Is package complete
  const isComplete = !!(state.vehicle && state.wheel && state.tire);
  const canGenerateQuote = isComplete;

  const value: POSContextValue = {
    state,

    setVehicle: (vehicle) => dispatch({ type: "SET_VEHICLE", payload: vehicle }),
    setBuildType: (buildType, liftConfig) =>
      dispatch({ type: "SET_BUILD_TYPE", payload: { buildType, liftConfig } }),
    setStaggeredInfo: (staggeredInfo) =>
      dispatch({ type: "SET_STAGGERED_INFO", payload: { staggeredInfo } }),
    setSetupMode: (mode) => dispatch({ type: "SET_SETUP_MODE", payload: mode }),
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

    isStaggered,
    supportsStaggered,
    subtotal,
    wheelsTotal,
    tiresTotal,
    laborTotal,
    liftInstallTotal,
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

// DEFAULT_FEES, FIXED_TAX_RATE, DEFAULT_ADMIN_SETTINGS are exported inline above
