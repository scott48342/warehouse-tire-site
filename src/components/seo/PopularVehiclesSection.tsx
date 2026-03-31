/**
 * Popular Vehicles Section
 * 
 * Internal linking component for main wheels/tires pages
 * Shows links to SEO routes for popular vehicles
 */

import Link from "next/link";

interface PopularVehicle {
  year: number;
  make: string;
  model: string;
  displayMake: string;
  displayModel: string;
}

interface Props {
  productType: "wheels" | "tires" | "packages";
  title?: string;
}

// Pre-defined popular vehicles for internal linking
const POPULAR_VEHICLES: PopularVehicle[] = [
  // Trucks
  { year: 2024, make: "ford", model: "f-150", displayMake: "Ford", displayModel: "F-150" },
  { year: 2024, make: "chevrolet", model: "silverado-1500", displayMake: "Chevrolet", displayModel: "Silverado 1500" },
  { year: 2024, make: "ram", model: "1500", displayMake: "Ram", displayModel: "1500" },
  { year: 2024, make: "toyota", model: "tacoma", displayMake: "Toyota", displayModel: "Tacoma" },
  { year: 2024, make: "toyota", model: "tundra", displayMake: "Toyota", displayModel: "Tundra" },
  { year: 2024, make: "gmc", model: "sierra-1500", displayMake: "GMC", displayModel: "Sierra 1500" },
  // SUVs
  { year: 2024, make: "jeep", model: "wrangler", displayMake: "Jeep", displayModel: "Wrangler" },
  { year: 2024, make: "jeep", model: "grand-cherokee", displayMake: "Jeep", displayModel: "Grand Cherokee" },
  { year: 2024, make: "toyota", model: "rav4", displayMake: "Toyota", displayModel: "RAV4" },
  { year: 2024, make: "honda", model: "cr-v", displayMake: "Honda", displayModel: "CR-V" },
  { year: 2024, make: "ford", model: "bronco", displayMake: "Ford", displayModel: "Bronco" },
  { year: 2024, make: "toyota", model: "4runner", displayMake: "Toyota", displayModel: "4Runner" },
  // Sedans
  { year: 2024, make: "toyota", model: "camry", displayMake: "Toyota", displayModel: "Camry" },
  { year: 2024, make: "honda", model: "civic", displayMake: "Honda", displayModel: "Civic" },
  { year: 2024, make: "honda", model: "accord", displayMake: "Honda", displayModel: "Accord" },
  // EVs
  { year: 2024, make: "tesla", model: "model-y", displayMake: "Tesla", displayModel: "Model Y" },
  { year: 2024, make: "tesla", model: "model-3", displayMake: "Tesla", displayModel: "Model 3" },
  // Sports
  { year: 2024, make: "ford", model: "mustang", displayMake: "Ford", displayModel: "Mustang" },
];

const productLabels = {
  wheels: "Wheels",
  tires: "Tires",
  packages: "Packages",
};

export function PopularVehiclesSection({ productType, title }: Props) {
  const label = productLabels[productType];
  const defaultTitle = `Shop ${label} by Popular Vehicle`;
  
  return (
    <section className="mt-12 border-t border-neutral-200 pt-8">
      <h2 className="mb-6 text-2xl font-bold text-neutral-900">
        {title || defaultTitle}
      </h2>
      
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {POPULAR_VEHICLES.map((v) => (
          <Link
            key={`${v.year}-${v.make}-${v.model}`}
            href={`/${productType}/${v.year}/${v.make}/${v.model}`}
            className="group rounded-lg border border-neutral-200 bg-white p-3 text-center transition hover:border-red-200 hover:shadow-sm"
          >
            <div className="text-sm font-medium text-neutral-900 group-hover:text-red-600">
              {v.year} {v.displayMake}
            </div>
            <div className="text-xs text-neutral-500">
              {v.displayModel}
            </div>
          </Link>
        ))}
      </div>
      
      {/* Additional years */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">
          Browse Other Model Years
        </h3>
        <div className="flex flex-wrap gap-2">
          {[2023, 2022, 2021, 2020, 2019].map((year) => (
            <Link
              key={year}
              href={`/${productType}/${year}/ford/f-150`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-red-200 hover:text-red-600"
            >
              {year} F-150
            </Link>
          ))}
          {[2023, 2022, 2021, 2020].map((year) => (
            <Link
              key={`wrangler-${year}`}
              href={`/${productType}/${year}/jeep/wrangler`}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-red-200 hover:text-red-600"
            >
              {year} Wrangler
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Compact version for sidebar or smaller spaces
 */
export function PopularVehiclesCompact({ productType }: Props) {
  const label = productLabels[productType];
  const vehicles = POPULAR_VEHICLES.slice(0, 8);
  
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        Popular {label}
      </h3>
      <ul className="space-y-2">
        {vehicles.map((v) => (
          <li key={`${v.year}-${v.make}-${v.model}`}>
            <Link
              href={`/${productType}/${v.year}/${v.make}/${v.model}`}
              className="text-sm text-neutral-600 hover:text-red-600"
            >
              {v.year} {v.displayMake} {v.displayModel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
