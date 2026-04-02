/**
 * Package Prioritization Logic
 * 
 * Applies ONLY when: searchType === 'package' OR buildType === 'lifted'
 * 
 * PRIORITY TIERS:
 * Tier 1: supplier === 'wheelpros' AND imageUrl exists AND stock > 0
 * Tier 2: imageUrl exists AND stock > 0
 * Tier 3: supplier === 'wheelpros' AND stock > 0
 * Tier 4: everything else
 * 
 * SORTING RULE:
 * Sort by tier ASC (1 → 4)
 * Within same tier → sort by price ASC
 * 
 * NOTES:
 * - Does NOT remove results (only reorders)
 * - Does NOT apply to tire-only or wheel-only searches
 * - Must work for both tires and wheels inside package builder
 */

export interface PackagePrioritizableItem {
  sku: string;
  supplier?: string;          // 'wheelpros', 'tirewire', 'km', etc.
  imageUrl?: string | null;   // Any truthy image URL
  stock?: number;             // Total stock qty (localStock + globalStock or similar)
  price?: number;             // For secondary sort within tier
  // Allow any other properties
  [key: string]: unknown;
}

export type PackagePriorityTier = 1 | 2 | 3 | 4;

/**
 * Calculate the priority tier for an item
 */
export function getPackagePriorityTier(item: PackagePrioritizableItem): PackagePriorityTier {
  const isWheelPros = item.supplier?.toLowerCase() === 'wheelpros';
  const hasImage = Boolean(item.imageUrl);
  const inStock = (item.stock ?? 0) > 0;

  // Tier 1: WheelPros + has image + in stock
  if (isWheelPros && hasImage && inStock) return 1;

  // Tier 2: Has image + in stock (any supplier)
  if (hasImage && inStock) return 2;

  // Tier 3: WheelPros + in stock (no image)
  if (isWheelPros && inStock) return 3;

  // Tier 4: Everything else
  return 4;
}

/**
 * Sort items by package priority tiers, then by price within each tier
 * 
 * @param items - Array of items to sort
 * @returns New sorted array (does not mutate input)
 */
export function sortByPackagePriority<T extends PackagePrioritizableItem>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const tierA = getPackagePriorityTier(a);
    const tierB = getPackagePriorityTier(b);

    // Sort by tier first (ascending: 1 → 4)
    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Within same tier, sort by price ascending
    const priceA = a.price ?? Infinity;
    const priceB = b.price ?? Infinity;
    return priceA - priceB;
  });
}

/**
 * Check if package prioritization should be applied based on params
 */
export function shouldApplyPackagePriority(params: {
  searchType?: string;
  buildType?: string;
  package?: string;
  isPackageFlow?: boolean;
  isLiftedBuild?: boolean;
}): boolean {
  // Explicit param check
  if (params.searchType === 'package') return true;
  if (params.buildType === 'lifted') return true;
  
  // Boolean flags from page context
  if (params.isPackageFlow === true) return true;
  if (params.isLiftedBuild === true) return true;
  
  // URL param ?package=1
  if (params.package === '1') return true;
  
  return false;
}

/**
 * Apply package prioritization to wheel results
 * Extracts relevant fields and re-sorts the results
 */
export function applyPackagePriorityToWheels<T extends Record<string, any>>(
  results: T[],
  options: {
    supplierField?: string;      // Field name for supplier (default: tries multiple)
    imageField?: string;         // Field name for image URL (default: tries multiple)
    stockField?: string;         // Field name for stock qty (default: tries multiple)
    priceField?: string;         // Field name for price (default: tries multiple)
  } = {}
): T[] {
  // Map results to prioritizable format
  const mapped = results.map((item) => {
    // Extract supplier
    let supplier = 'wheelpros'; // Default for wheel results from our DB
    if (options.supplierField && item[options.supplierField]) {
      supplier = String(item[options.supplierField]);
    } else if (item.supplier) {
      supplier = String(item.supplier);
    } else if (item.source) {
      supplier = String(item.source);
    }

    // Extract image URL
    let imageUrl: string | null = null;
    if (options.imageField && item[options.imageField]) {
      imageUrl = String(item[options.imageField]);
    } else if (item.imageUrl) {
      imageUrl = String(item.imageUrl);
    } else if (item.images?.[0]?.imageUrlLarge) {
      imageUrl = String(item.images[0].imageUrlLarge);
    } else if (Array.isArray(item.images) && item.images.length > 0) {
      const firstImg = item.images[0];
      imageUrl = typeof firstImg === 'string' ? firstImg : firstImg?.imageUrlLarge || firstImg?.imageUrlMedium || null;
    }

    // Extract stock
    let stock = 0;
    if (options.stockField && item[options.stockField] != null) {
      stock = Number(item[options.stockField]) || 0;
    } else if (item.stockQty != null) {
      stock = Number(item.stockQty) || 0;
    } else if (item.inventory) {
      stock = (Number(item.inventory.localStock) || 0) + (Number(item.inventory.globalStock) || 0);
    } else if (item.availability?.totalQty != null) {
      stock = Number(item.availability.totalQty) || 0;
    }

    // Extract price
    let price = Infinity;
    if (options.priceField && item[options.priceField] != null) {
      price = Number(item[options.priceField]) || Infinity;
    } else if (item.price != null) {
      price = Number(item.price) || Infinity;
    } else if (item.prices?.msrp?.[0]?.currencyAmount) {
      price = Number(item.prices.msrp[0].currencyAmount) || Infinity;
    }

    return {
      ...item,
      _pkgPriority: {
        sku: item.sku || '',
        supplier,
        imageUrl,
        stock,
        price,
      } as PackagePrioritizableItem,
    };
  });

  // Sort by package priority
  const sorted = [...mapped].sort((a, b) => {
    const tierA = getPackagePriorityTier(a._pkgPriority);
    const tierB = getPackagePriorityTier(b._pkgPriority);

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    return (a._pkgPriority.price ?? 0) - (b._pkgPriority.price ?? 0);
  });

  // Remove temporary _pkgPriority field and return
  return sorted.map(({ _pkgPriority, ...rest }) => rest as unknown as T);
}

/**
 * Apply package prioritization to tire results
 * Similar to wheels but handles tire-specific field names
 */
export function applyPackagePriorityToTires<T extends Record<string, any>>(
  results: T[]
): T[] {
  const mapped = results.map((item) => {
    // Tire supplier detection
    let supplier = 'unknown';
    if (item.source) {
      supplier = String(item.source);
      // Normalize supplier names
      if (supplier.startsWith('tirewire:')) supplier = 'tirewire';
      if (supplier === 'wheelpros' || supplier === 'wp') supplier = 'wheelpros';
    }

    // Image URL
    const imageUrl = item.imageUrl || null;

    // Stock (tires use quantity object)
    let stock = 0;
    if (item.quantity) {
      stock = (Number(item.quantity.primary) || 0) + 
              (Number(item.quantity.alternate) || 0) + 
              (Number(item.quantity.national) || 0);
    } else if (item.stockQty != null) {
      stock = Number(item.stockQty) || 0;
    }

    // Price
    const price = Number(item.price || item.cost) || Infinity;

    return {
      ...item,
      _pkgPriority: {
        sku: item.partNumber || item.sku || '',
        supplier,
        imageUrl,
        stock,
        price,
      } as PackagePrioritizableItem,
    };
  });

  // Sort
  const sorted = [...mapped].sort((a, b) => {
    const tierA = getPackagePriorityTier(a._pkgPriority);
    const tierB = getPackagePriorityTier(b._pkgPriority);

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    return (a._pkgPriority.price ?? 0) - (b._pkgPriority.price ?? 0);
  });

  return sorted.map(({ _pkgPriority, ...rest }) => rest as unknown as T);
}
