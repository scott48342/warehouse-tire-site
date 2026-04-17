/**
 * Shop Context - Dual-Host Architecture
 * 
 * Detects whether the shop is running in NATIONAL or LOCAL mode based on
 * the request host/path. This enables one codebase to serve two distinct
 * shopping experiences:
 * 
 * NATIONAL MODE (shop.warehousetiredirect.com):
 * - Pure ecommerce/shipping experience
 * - No local installation UI
 * - No store selector
 * - No local fees/services
 * 
 * LOCAL MODE (warehousetire.net/shop OR shop.warehousetire.net):
 * - Local installation pathway
 * - Store selector (Pontiac / Waterford)
 * - Install-oriented messaging
 * - Local service add-ons
 * 
 * CRITICAL: National mode must NEVER show local UI elements.
 * This is enforced via hard logic gates, not CSS hiding.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ShopMode = 'national' | 'local';

export type LocalStore = 'pontiac' | 'waterford';

export interface StoreInfo {
  id: LocalStore;
  name: string;
  displayName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  hours: {
    weekday: string;
    saturday: string;
    sunday: string;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface ShopContext {
  mode: ShopMode;
  
  // Only populated in local mode
  selectedStore?: LocalStore;
  storeInfo?: StoreInfo;
  
  // Detection metadata (for debugging)
  detectedFrom: 'host' | 'path' | 'query' | 'cookie' | 'default';
  host: string;
  path: string;
}

export interface LocalOrderMetadata {
  channel: 'local';
  installStore: LocalStore;
  fulfillmentMode: 'install';
  storePhone: string;
  storeAddress: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE DATA
// ═══════════════════════════════════════════════════════════════════════════

export const STORES: Record<LocalStore, StoreInfo> = {
  pontiac: {
    id: 'pontiac',
    name: 'Warehouse Tire – Pontiac',
    displayName: 'Pontiac',
    address: '1100 Cesar E Chavez Ave',
    city: 'Pontiac',
    state: 'MI',
    zip: '48340',
    phone: '248-332-4120',
    hours: {
      weekday: '8am - 5pm',
      saturday: '8am - 3pm',
      sunday: 'Closed',
    },
    coordinates: {
      lat: 42.6389,
      lng: -83.2910,
    },
  },
  waterford: {
    id: 'waterford',
    name: 'Warehouse Tire – Waterford',
    displayName: 'Waterford',
    address: '4459 Pontiac Lake Road',
    city: 'Waterford',
    state: 'MI',
    zip: '48328',
    phone: '248-683-0070',
    hours: {
      weekday: '8am - 5pm',
      saturday: '8am - 3pm',
      sunday: 'Closed',
    },
    coordinates: {
      lat: 42.6615,
      lng: -83.3829,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HOST CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

// National mode hosts (exact match)
const NATIONAL_HOSTS = [
  'shop.warehousetiredirect.com',
  'www.warehousetiredirect.com',
  'warehousetiredirect.com',
];

// Local mode hosts (exact match)
const LOCAL_HOSTS = [
  'shop.warehousetire.net',
  'local.warehousetire.net',
];

// Local mode path prefix (for reverse proxy setup)
const LOCAL_PATH_PREFIX = '/shop';

// Host that uses path-based local detection
const LOCAL_PATH_HOST = 'warehousetire.net';

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect shop context from request headers.
 * Use this in API routes and server components.
 */
export function detectShopContext(headers: Headers): ShopContext {
  const host = headers.get('host') || headers.get('x-forwarded-host') || '';
  const pathname = headers.get('x-invoke-path') || '/';
  
  return detectShopContextFromHostPath(host, pathname);
}

/**
 * Detect shop context from host and pathname.
 * Core detection logic used by both server and client.
 */
export function detectShopContextFromHostPath(
  host: string,
  pathname: string
): ShopContext {
  const normalizedHost = host.toLowerCase().replace(/:\d+$/, ''); // Remove port
  
  // Check for explicit national hosts
  if (NATIONAL_HOSTS.includes(normalizedHost)) {
    return {
      mode: 'national',
      detectedFrom: 'host',
      host: normalizedHost,
      path: pathname,
    };
  }
  
  // Check for explicit local hosts (subdomain approach)
  if (LOCAL_HOSTS.includes(normalizedHost)) {
    const store = detectStoreFromPath(pathname) || 'pontiac'; // Default to Pontiac
    return {
      mode: 'local',
      selectedStore: store,
      storeInfo: STORES[store],
      detectedFrom: 'host',
      host: normalizedHost,
      path: pathname,
    };
  }
  
  // Check for path-based local mode (reverse proxy approach)
  if (normalizedHost === LOCAL_PATH_HOST || normalizedHost === `www.${LOCAL_PATH_HOST}`) {
    if (pathname.startsWith(LOCAL_PATH_PREFIX)) {
      const store = detectStoreFromPath(pathname) || 'pontiac';
      return {
        mode: 'local',
        selectedStore: store,
        storeInfo: STORES[store],
        detectedFrom: 'path',
        host: normalizedHost,
        path: pathname,
      };
    }
  }
  
  // Development / preview / unknown hosts: check for ?mode=local query param
  // This is for testing only - production should use host/path detection
  if (normalizedHost.includes('localhost') || normalizedHost.includes('vercel.app')) {
    // Check URL query params for local mode testing
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'local') {
        const store = (params.get('store') as LocalStore) || 'pontiac';
        return {
          mode: 'local',
          selectedStore: store,
          storeInfo: STORES[store],
          detectedFrom: 'query',
          host: normalizedHost,
          path: pathname,
        };
      }
    }
    // In dev/preview, default to national unless explicitly testing local
    return {
      mode: 'national',
      detectedFrom: 'default',
      host: normalizedHost,
      path: pathname,
    };
  }
  
  // Default to national mode for safety
  return {
    mode: 'national',
    detectedFrom: 'default',
    host: normalizedHost,
    path: pathname,
  };
}

/**
 * Detect store from path segments like /shop/pontiac/... or /shop/waterford/...
 */
function detectStoreFromPath(pathname: string): LocalStore | null {
  const segments = pathname.toLowerCase().split('/').filter(Boolean);
  
  // Check if any segment matches a store ID
  for (const segment of segments) {
    if (segment === 'pontiac') return 'pontiac';
    if (segment === 'waterford') return 'waterford';
  }
  
  return null;
}

/**
 * Client-side context detection using window.location
 */
export function detectShopContextClient(): ShopContext {
  if (typeof window === 'undefined') {
    // SSR fallback - will be hydrated with correct context
    return {
      mode: 'national',
      detectedFrom: 'default',
      host: '',
      path: '',
    };
  }
  
  return detectShopContextFromHostPath(
    window.location.host,
    window.location.pathname
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if current context is national mode.
 * Use this to guard national-only features.
 */
export function isNationalMode(ctx: ShopContext): boolean {
  return ctx.mode === 'national';
}

/**
 * Check if current context is local mode.
 * Use this to guard local-only features.
 */
export function isLocalMode(ctx: ShopContext): boolean {
  return ctx.mode === 'local';
}

/**
 * Assert context is local mode - throws if not.
 * Use in local-only components/routes as a hard gate.
 */
export function assertLocalMode(ctx: ShopContext): asserts ctx is ShopContext & { 
  mode: 'local'; 
  selectedStore: LocalStore; 
  storeInfo: StoreInfo;
} {
  if (ctx.mode !== 'local') {
    throw new Error('This feature requires local mode');
  }
  if (!ctx.selectedStore || !ctx.storeInfo) {
    throw new Error('Local mode requires a selected store');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate local order metadata for checkout.
 * Only call this in local mode.
 */
export function buildLocalOrderMetadata(ctx: ShopContext): LocalOrderMetadata | null {
  if (!isLocalMode(ctx) || !ctx.selectedStore || !ctx.storeInfo) {
    return null;
  }
  
  return {
    channel: 'local',
    installStore: ctx.selectedStore,
    fulfillmentMode: 'install',
    storePhone: ctx.storeInfo.phone,
    storeAddress: `${ctx.storeInfo.address}, ${ctx.storeInfo.city}, ${ctx.storeInfo.state} ${ctx.storeInfo.zip}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// URL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the base URL for the current shop context.
 */
export function getShopBaseUrl(ctx: ShopContext): string {
  if (ctx.mode === 'national') {
    return 'https://shop.warehousetiredirect.com';
  }
  // Local mode - prefer subdomain approach
  return 'https://shop.warehousetire.net';
}

/**
 * Build a product URL for the current context.
 */
export function buildProductUrl(
  ctx: ShopContext,
  productType: 'wheels' | 'tires',
  sku: string
): string {
  const base = getShopBaseUrl(ctx);
  return `${base}/${productType}/${sku}`;
}

/**
 * Build canonical URL (always points to national site for SEO).
 */
export function buildCanonicalUrl(
  productType: 'wheels' | 'tires',
  sku: string
): string {
  return `https://shop.warehousetiredirect.com/${productType}/${sku}`;
}
