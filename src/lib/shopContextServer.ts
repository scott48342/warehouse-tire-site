/**
 * Shop Context - Server-Side Utilities
 * 
 * Use these functions in Server Components and API routes
 * to detect shop mode.
 */

import { headers } from 'next/headers';
import { 
  ShopContext, 
  ShopMode, 
  LocalStore, 
  STORES, 
  detectShopContextFromHostPath 
} from './shopContext';

/**
 * Get shop context in a Server Component.
 * Reads from request headers set by middleware.
 */
export async function getShopContext(): Promise<ShopContext> {
  const headersList = await headers();
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
  const pathname = headersList.get('x-invoke-path') || '/';
  const modeHeader = headersList.get('x-shop-mode');
  
  // If middleware set the mode, trust it
  if (modeHeader === 'local') {
    const store = detectStoreFromCookie(headersList) || 'pontiac';
    return {
      mode: 'local',
      selectedStore: store,
      storeInfo: STORES[store],
      detectedFrom: 'host',
      host,
      path: pathname,
    };
  }
  
  // Fall back to full detection
  return detectShopContextFromHostPath(host, pathname);
}

/**
 * Get shop mode only (lightweight check).
 */
export async function getShopMode(): Promise<ShopMode> {
  const headersList = await headers();
  const modeHeader = headersList.get('x-shop-mode');
  return (modeHeader === 'local' ? 'local' : 'national') as ShopMode;
}

/**
 * Check if running in local mode.
 */
export async function isLocalModeServer(): Promise<boolean> {
  return (await getShopMode()) === 'local';
}

/**
 * Check if running in national mode.
 */
export async function isNationalModeServer(): Promise<boolean> {
  return (await getShopMode()) === 'national';
}

/**
 * Detect store selection from cookie.
 */
function detectStoreFromCookie(headersList: Headers): LocalStore | null {
  const cookieHeader = headersList.get('cookie') || '';
  const match = cookieHeader.match(/wt_selected_store=(pontiac|waterford)/);
  if (match) {
    return match[1] as LocalStore;
  }
  return null;
}

/**
 * Build metadata for local orders (use in checkout API).
 */
export function buildOrderMetadata(
  mode: ShopMode, 
  selectedStore?: LocalStore
): Record<string, string> | null {
  if (mode !== 'local' || !selectedStore) {
    return null;
  }
  
  const store = STORES[selectedStore];
  return {
    channel: 'local',
    install_store: selectedStore,
    install_store_name: store.name,
    install_store_phone: store.phone,
    install_store_address: `${store.address}, ${store.city}, ${store.state} ${store.zip}`,
    fulfillment_mode: 'install',
  };
}
