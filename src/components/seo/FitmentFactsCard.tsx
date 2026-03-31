/**
 * Fitment Facts Card Component
 * 
 * Displays vehicle fitment specifications in a clean grid
 */

import type { FitmentFactItem } from "@/lib/seo/content";

interface Props {
  items: FitmentFactItem[];
}

export function FitmentFactsCard({ items }: Props) {
  if (items.length === 0) return null;
  
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
      <h2 className="mb-4 text-lg font-bold text-neutral-900">
        Vehicle Specifications
      </h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, idx) => (
          <div key={idx}>
            <dt className="text-sm text-neutral-500">{item.label}</dt>
            <dd className="mt-1 font-semibold text-neutral-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
