/**
 * US AutoForce Direct API Types
 * 
 * Based on actual API responses (tested 2026-04-29)
 * and integration docs from Jennifer Fletcher
 */

// ============================================================================
// WAREHOUSE
// ============================================================================

export interface USAutoForceWarehouse {
  code: string;           // D365 warehouse code (e.g., "4862")
  metroArea: string;      // e.g., "Boston"
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  notes?: string;         // e.g., "Moved as of 3/2026"
}

export interface USAutoForceWarehouseAvailability {
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  quantityAvailable: number;
  transferRequired: boolean;
  cutoffDateTime?: string;
  deliveryDate?: string;
}

// ============================================================================
// STOCK CHECK
// ============================================================================

export interface USAutoForceStockItem {
  // Identifiers
  partNumber: string;
  lineNumber: number;
  brandCode: string;        // e.g., "GEN", "BFG", "TOY"
  
  // Product info
  description: string;
  model: string;
  tireType: string;         // e.g., "PASSENGER/CUV/SUV"
  salesClass: string;       // e.g., "General ALTIMAX ARCTIC 12"
  
  // Size info
  width: number;
  aspectRatio: number;
  rimDiameter: number;
  tireSize: string;         // e.g., "2256016"
  
  // Pricing (from API - all numbers)
  cost: number;             // Dealer cost
  map: number;              // Minimum Advertised Price
  list: number;             // List price (often 0)
  retailPrice: number;      // Retail price (often 0)
  gmCost: number;           // GM cost
  gmRetail: number;         // GM retail
  fet: number;              // Federal excise tax
  
  // Specs
  speedRating: string;      // e.g., "T", "H", "V"
  loadIndex: string;        // e.g., "98", "102"
  loadRange: string;        // e.g., "SL", "XL", "E"
  utqg: string;             // e.g., "700BA", "NA"
  treadDepth: number;       // mm
  weight: number;           // lbs
  sidewall: string;         // e.g., "BLK", "WW"
  warranty: number;         // miles (often 0)
  oeFit: string;            // OE fitment info
  
  // Media
  imageUrl: string | null;  // Azure CDN hosted image
  specUrl: string | null;   // PDF spec sheet
  
  // Availability
  quantityRequested: number;
  availability: USAutoForceWarehouseAvailability[];
  
  // Flags
  onSpecial: boolean;
  isSSP: boolean;           // Special Sales Program
}

export interface USAutoForceStockCheckResponse {
  success: boolean;
  branch: string;
  items: USAutoForceStockItem[];
  errorCode?: string;
  errorMessage?: string;
  transactionId?: string;
}

// ============================================================================
// ORDER PLACEMENT
// ============================================================================

export interface USAutoForceOrderItem {
  partNumber: string;
  quantity: number;
  /** 
   * Brand code (e.g., "GEN", "BFG", "TOY") - REQUIRED!
   * The USAF Order API requires lineCode for all items.
   * Get this from the StockCheck response's lineCodes field.
   */
  lineCode: string;
}

export interface USAutoForceShipToAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
}

export interface USAutoForceOrderRequest {
  /** Your PO number (must be unique per order) */
  purchaseOrderNumber: string;
  
  /** Items to order */
  items: USAutoForceOrderItem[];
  
  /** Ship-to address - required for label generation */
  shipTo: USAutoForceShipToAddress;
  
  /** Specific warehouse code (optional) */
  warehouseCode?: string;
  
  /** Delivery method: "FedEx-Grou", "UPS-Grou", "USPS-Mail" */
  deliveryMethod?: string;
  
  /** Fill flag: "backord" or "cancel" */
  fillFlag?: string;
  
  /** Vehicle or special instructions */
  notes?: string;
}

export interface USAutoForceOrderLineResult {
  lineNumber: number;
  partNumber: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityBackOrdered: number;
  cost: number;
  list: number;
  errorCode: string;
  errorMessage: string;
}

export interface USAutoForceOrderResponse {
  success: boolean;
  orderNumber?: string;
  poNumber?: string;
  status?: string;          // "ordered", "shipped", etc.
  branch?: string;
  deliveryMethod?: string;
  deliveryCost?: number;
  tax?: number;
  comment?: string;
  lines?: USAutoForceOrderLineResult[];
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// ORDER STATUS
// ============================================================================

export interface USAutoForceOrderStatusResponse {
  success: boolean;
  status?: string;          // "complete", "shipped", etc.
  orderNumber?: string;
  invoiceNumber?: string;
  poNumber?: string;
  orderDate?: string;
  invoiceDate?: string;
  totalCost?: number;
  coreTotal?: number;
  trackingNumbers?: string[];
  lineItemCount?: number;
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// FTP FLAT FILES
// ============================================================================

export interface USAutoForceFTPInventoryRow {
  warehouseCode: string;    // D365WarehouseCode
  brandCode: string;        // BrandCode
  partNumber: string;       // PartNumber
  quantityAvailable: number; // QuantityAvailable
}

// ============================================================================
// VEHICLE LOOKUP (GetVehicleOptions)
// ============================================================================

export interface USAutoForceVehicleOption {
  /** OE tire size (e.g., "245/70R17", "LT315/70R17/C") */
  tireSize: string;
  /** Optional: year, make, model echoed back */
  year?: number;
  make?: string;
  model?: string;
}

export interface USAutoForceVehicleOptionsResponse {
  success: boolean;
  year: number;
  make: string;
  model: string;
  options: USAutoForceVehicleOption[];
  errorCode?: string;
  errorMessage?: string;
}

export interface USAutoForceVehicleYearsResponse {
  success: boolean;
  years: number[];
  errorCode?: string;
  errorMessage?: string;
}

export interface USAutoForceVehicleMakesResponse {
  success: boolean;
  year: number;
  makes: string[];
  errorCode?: string;
  errorMessage?: string;
}

export interface USAutoForceVehicleModelsResponse {
  success: boolean;
  year: number;
  make: string;
  models: string[];
  errorCode?: string;
  errorMessage?: string;
}

// ============================================================================
// CREDENTIALS
// ============================================================================

export interface USAutoForceCredentials {
  username: string;
  password: string;
  accountNumber: string;
}

export interface USAutoForceFTPCredentials {
  host: string;
  username: string;
  password: string;
  path?: string;            // e.g., "/USAutoForce/1180608_WarehouseTire"
}

// ============================================================================
// CLIENT CONFIG
// ============================================================================

export interface USAutoForceConfig {
  /** API credentials */
  api: USAutoForceCredentials;
  
  /** FTP credentials for flat file sync */
  ftp?: USAutoForceFTPCredentials;
  
  /** Base URL for API */
  apiBaseUrl: string;
  
  /** Whether this is test mode */
  isTest: boolean;
}
