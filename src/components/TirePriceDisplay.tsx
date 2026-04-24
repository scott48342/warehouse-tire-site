'use client';

/**
 * Tire Price Display Component
 * 
 * Displays tire pricing differently based on shop mode:
 * - National: Shows per-tire + set of 4 price
 * - Local: Shows out-the-door price including labor, recycling, and tax
 */

import { useShopContext } from '@/contexts/ShopContextProvider';
import { getOutTheDoorTotal, formatPrice } from '@/lib/localPricing';
import { FinancingBadge } from '@/components/FinancingBadge';

interface TirePriceDisplayProps {
  unitPrice: number;
  quantity?: number;
  showFinancing?: boolean;
  /** Compact mode for smaller cards */
  compact?: boolean;
  /** Override shop mode detection (for server components) */
  isLocalMode?: boolean;
}

export function TirePriceDisplay({
  unitPrice,
  quantity = 4,
  showFinancing = true,
  compact = false,
  isLocalMode,
}: TirePriceDisplayProps) {
  // Use prop if provided, otherwise detect from context
  const shopContext = useShopContext();
  const isLocal = isLocalMode ?? shopContext.isLocal;
  
  const setPrice = unitPrice * quantity;
  const outTheDoorPrice = getOutTheDoorTotal(unitPrice, quantity);
  
  if (isLocal) {
    // LOCAL MODE: Show out-the-door price
    return (
      <div className="flex flex-col gap-1">
        {/* Per tire price - smaller */}
        <div className="flex items-baseline gap-1">
          <span className={compact ? "text-sm font-semibold text-neutral-700" : "text-base font-semibold text-neutral-700"}>
            ${unitPrice.toFixed(2)}
          </span>
          <span className="text-xs text-neutral-500">per tire</span>
        </div>
        
        {/* Out-the-door total - prominent */}
        <div className="flex flex-col gap-0.5 px-2 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-baseline gap-1">
            <span className={compact ? "text-lg font-extrabold text-green-800" : "text-xl font-extrabold text-green-800"}>
              ${formatPrice(outTheDoorPrice)}
            </span>
            <span className="text-xs font-medium text-green-700">out the door</span>
          </div>
          <span className="text-[10px] text-green-600">
            Includes install, tax & recycling
          </span>
        </div>
        
        {/* Affirm financing */}
        {showFinancing && outTheDoorPrice >= 50 && (
          <FinancingBadge price={outTheDoorPrice} variant="compact" />
        )}
      </div>
    );
  }
  
  // NATIONAL MODE: Standard per-tire + set pricing
  return (
    <div className="flex flex-col gap-1">
      {/* Per tire price - prominent */}
      <div className="flex items-baseline gap-1">
        <span className={compact ? "text-base font-bold text-neutral-900" : "text-lg font-bold text-neutral-900"}>
          ${unitPrice.toFixed(2)}
        </span>
        <span className="text-sm text-neutral-600">per tire</span>
      </div>
      
      {/* Set of 4 total */}
      <div className="flex items-baseline gap-1 px-2 py-1 bg-neutral-50 rounded-lg">
        <span className={compact ? "text-lg font-extrabold text-neutral-900" : "text-xl font-extrabold text-neutral-900"}>
          ${formatPrice(setPrice)}
        </span>
        <span className="text-xs font-medium text-neutral-500">for all {quantity}</span>
      </div>
      
      {/* Affirm financing */}
      {showFinancing && setPrice >= 50 && (
        <FinancingBadge price={setPrice} variant="compact" />
      )}
    </div>
  );
}

/**
 * Simple inline price for lists/tables
 */
export function TirePriceInline({ unitPrice, quantity = 4 }: { unitPrice: number; quantity?: number }) {
  const { isLocal } = useShopContext();
  
  if (isLocal) {
    const outTheDoorPrice = getOutTheDoorTotal(unitPrice, quantity);
    return (
      <span className="font-bold text-green-800">
        ${formatPrice(outTheDoorPrice)}
        <span className="text-xs font-normal text-green-600 ml-1">out the door</span>
      </span>
    );
  }
  
  return (
    <span className="font-bold text-neutral-900">
      ${formatPrice(unitPrice * quantity)}
      <span className="text-xs font-normal text-neutral-500 ml-1">for {quantity}</span>
    </span>
  );
}
