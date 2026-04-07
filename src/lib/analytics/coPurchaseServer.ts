/**
 * Server-side Co-Purchase Data Fetching
 * 
 * Use these functions in Server Components (page.tsx) to fetch
 * co-purchase recommendations. Do NOT import in client components.
 * 
 * @created 2026-04-06
 */

import { getCoAddedProducts, getCoAddedForCart, type CoAddedProduct } from "./coPurchase";

export type { CoAddedProduct };

/**
 * Server-side data fetching for PDP
 * Use this in page.tsx to fetch co-add data
 */
export async function getCoAddedProductsForPDP(
  sku: string,
  productType: "tire" | "wheel"
): Promise<CoAddedProduct[]> {
  try {
    // For wheels/tires, prioritize accessories
    const products = await getCoAddedProducts(sku, {
      limit: 4,
      productTypes: ["accessory"], // Prioritize accessories
    });
    
    return products;
  } catch (err) {
    console.error(`[coPurchaseServer] Failed to fetch for ${sku}:`, err);
    return [];
  }
}

/**
 * Server-side data fetching for cart
 */
export async function getCoAddedProductsForCart(
  cartSkus: string[]
): Promise<CoAddedProduct[]> {
  try {
    const products = await getCoAddedForCart(cartSkus, {
      limit: 4,
    });
    
    return products;
  } catch (err) {
    console.error(`[coPurchaseServer] Failed to fetch for cart:`, err);
    return [];
  }
}
