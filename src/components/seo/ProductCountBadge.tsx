/**
 * Product Count Badge
 * 
 * Displays product count near the H1 on SEO pages
 */

import { formatCount } from "@/lib/seo";
import type { ProductType } from "@/lib/seo/types";

interface Props {
  count: number;
  productType: ProductType;
}

const typeLabels: Record<ProductType, string> = {
  wheels: "wheels",
  tires: "tires",
  packages: "packages",
};

export function ProductCountBadge({ count, productType }: Props) {
  if (count === 0) return null;
  
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
      <svg 
        className="h-4 w-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M5 13l4 4L19 7" 
        />
      </svg>
      {formatCount(count)} {typeLabels[productType]} available
    </span>
  );
}
