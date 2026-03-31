/**
 * Popular Sizes Section
 * 
 * Data-driven display of popular wheel sizes for a vehicle
 */

import Link from "next/link";
import type { ResolvedVehicle } from "@/lib/seo/types";

interface Props {
  title: string;
  sizes: { diameter: number; count: number }[];
  vehicle: ResolvedVehicle;
}

export function PopularSizesSection({ title, sizes, vehicle }: Props) {
  if (sizes.length === 0) return null;
  
  const browseBase = `/wheels?year=${vehicle.year}&make=${vehicle.make}&model=${vehicle.model}`;
  
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-semibold text-neutral-900">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {sizes.map(({ diameter, count }) => (
          <Link
            key={diameter}
            href={`${browseBase}&diameter=${diameter}`}
            className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 text-center transition hover:border-red-200 hover:shadow-sm"
          >
            <div className="text-2xl font-bold text-neutral-900">
              {diameter}&quot;
            </div>
            <div className="text-sm text-neutral-500">
              {count} options
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-600 transition-transform group-hover:scale-x-100 scale-x-0" />
          </Link>
        ))}
      </div>
      
      {/* Fitment insight */}
      <p className="mt-4 text-sm text-neutral-500">
        💡 These are the most popular wheel diameters that fit your {vehicle.year} {vehicle.displayMake} {vehicle.displayModel}. 
        Larger diameters provide a sportier look, while smaller sizes offer better ride comfort.
      </p>
    </div>
  );
}
