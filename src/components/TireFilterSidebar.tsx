"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type { TreadCategory, MileageBand } from "@/lib/tires/normalization";
import { TireTypesGuide } from "@/components/BuyingGuides";
import { SearchableBrandFilter, PopularBrandBadges } from "./SearchableBrandFilter";

/* =============================================================================
   TYPES
============================================================================= */

type FilterData = {
  // URL state
  brands: string[];
  priceMin: number | null;
  priceMax: number | null;
  treadCategories: TreadCategory[];
  speeds: string[];
  loadRanges: string[];
  mileageBand: MileageBand | null;
  runFlat: boolean;
  snowRated: boolean;
  allWeather: boolean;
  xlOnly: boolean;
  
  // New size-based filters
  rimDiameters: number[];
  overallDiameters: string[];
  
  // Available options with counts
  brandOptions: Array<{ value: string; count: number }>;
  treadCategoryOptions: Array<{ value: TreadCategory; count: number }>;
  speedOptions: Array<{ value: string; count: number }>;
  loadRangeOptions: Array<{ value: string; count: number }>;
  mileageOptions: Array<{ value: MileageBand; count: number }>;
  
  // New size-based options
  rimDiameterOptions: Array<{ value: number; count: number }>;
  overallDiameterOptions: Array<{ value: string; count: number }>;
  
  // Feature counts
  runFlatCount: number;
  snowRatedCount: number;
  allWeatherCount: number;
  xlCount: number;
  
  // Context
  basePath: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  modification: string;
  selectedSize: string;
  sort: string;
  wheelSku: string;
  wheelDia: string;
  
  // In-stock counts (optional)
  inStockCount?: number;
  totalCount?: number;
};

/* =============================================================================
   CHEVRON ICON
============================================================================= */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/* =============================================================================
   ACCORDION SECTION
============================================================================= */

function AccordionSection({
  title,
  defaultOpen = false,
  selectedCount = 0,
  children,
  hidden = false,
}: {
  title: string;
  defaultOpen?: boolean;
  selectedCount?: number;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  
  if (hidden) return null;
  
  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-neutral-900">{title}</span>
          {selectedCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-neutral-900 px-1.5 text-[10px] font-bold text-white">
              {selectedCount}
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

/* =============================================================================
   FILTER CHECKBOX
============================================================================= */

function FilterCheckbox({
  label,
  checked,
  count,
  onChange,
}: {
  label: string;
  checked: boolean;
  count?: number;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between gap-2 py-1 hover:bg-neutral-50 -mx-2 px-2 rounded-lg transition-colors text-left"
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
            checked
              ? "border-neutral-900 bg-neutral-900"
              : "border-neutral-300 bg-white"
          }`}
        >
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm text-neutral-800">{label}</span>
      </div>
      {typeof count === "number" && (
        <span className="text-xs font-medium text-neutral-400">{count}</span>
      )}
    </button>
  );
}

/* =============================================================================
   PRICE INPUT WITH DEBOUNCE
============================================================================= */

function PriceInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Debounce 500ms
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  };
  
  const handleBlur = () => {
    // Apply immediately on blur
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onChange(localValue);
  };
  
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
    />
  );
}

/* =============================================================================
   MAIN SIDEBAR COMPONENT
============================================================================= */

export function TireFilterSidebar({ data }: { data: FilterData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Build URL with updated params
  const buildUrl = useCallback((updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Always preserve base params
    if (data.year) params.set("year", data.year);
    if (data.make) params.set("make", data.make);
    if (data.model) params.set("model", data.model);
    if (data.trim) params.set("trim", data.trim);
    if (data.modification) params.set("modification", data.modification);
    if (data.selectedSize) params.set("size", data.selectedSize);
    if (data.sort) params.set("sort", data.sort);
    if (data.wheelSku) params.set("wheelSku", data.wheelSku);
    if (data.wheelDia) params.set("wheelDia", data.wheelDia);
    
    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      params.delete(key);
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        // Remove param
      } else if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, v);
        }
      } else {
        params.set(key, value);
      }
    }
    
    // Reset to page 1 when filters change
    params.delete("page");
    
    return `${data.basePath}?${params.toString()}`;
  }, [searchParams, data]);
  
  // Toggle a value in an array filter
  const toggleArrayFilter = useCallback((key: string, value: string, currentValues: string[]) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    router.push(buildUrl({ [key]: newValues }));
  }, [router, buildUrl]);
  
  // Toggle a boolean filter
  const toggleBooleanFilter = useCallback((key: string, currentValue: boolean) => {
    router.push(buildUrl({ [key]: currentValue ? null : "1" }));
  }, [router, buildUrl]);
  
  // Set a single-value filter
  const setSingleFilter = useCallback((key: string, value: string | null) => {
    router.push(buildUrl({ [key]: value }));
  }, [router, buildUrl]);
  
  // Update price filter
  const updatePrice = useCallback((minOrMax: "priceMin" | "priceMax", value: string) => {
    router.push(buildUrl({ [minOrMax]: value || null }));
  }, [router, buildUrl]);
  
  // Clear all filters URL
  const clearAllUrl = buildUrl({
    brand: null,
    priceMin: null,
    priceMax: null,
    treadCategory: null,
    speed: null,
    loadRange: null,
    mileageBand: null,
    runFlat: null,
    snowRated: null,
    allWeather: null,
    xl: null,
    rimDia: null,
    overallDia: null,
  });
  
  // Count total active filters
  const activeFilterCount = 
    data.brands.length +
    (data.priceMin !== null ? 1 : 0) +
    (data.priceMax !== null ? 1 : 0) +
    data.treadCategories.length +
    data.speeds.length +
    data.loadRanges.length +
    (data.mileageBand ? 1 : 0) +
    (data.runFlat ? 1 : 0) +
    (data.snowRated ? 1 : 0) +
    (data.allWeather ? 1 : 0) +
    data.rimDiameters.length +
    data.overallDiameters.length;

  return (
    <div>
      {/* Header with Clear All */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <h2 className="text-base font-extrabold text-neutral-900">Filters</h2>
        {activeFilterCount > 0 && (
          <Link
            href={clearAllUrl}
            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 hover:underline transition-colors"
          >
            Clear all ({activeFilterCount})
          </Link>
        )}
      </div>
      
      {/* Availability Section */}
      {data.inStockCount !== undefined && (
        <AccordionSection
          title="Availability"
          defaultOpen
          selectedCount={0}
        >
          <div className="text-sm text-neutral-600">
            <span className="font-semibold text-green-600">{data.inStockCount}</span> in stock
            {data.totalCount !== undefined && data.totalCount > data.inStockCount && (
              <span className="text-neutral-400"> of {data.totalCount}</span>
            )}
          </div>
        </AccordionSection>
      )}
      
      {/* Category Section */}
      <AccordionSection
        title="Category"
        defaultOpen
        selectedCount={data.treadCategories.length}
        hidden={data.treadCategoryOptions.length === 0}
      >
        <div className="space-y-0.5">
          {data.treadCategoryOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              checked={data.treadCategories.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("treadCategory", value, data.treadCategories)}
            />
          ))}
        </div>
        {/* Tire Types Guide - below filter options */}
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <TireTypesGuide variant="link" />
        </div>
      </AccordionSection>
      
      {/* Brand Section - Searchable with counts */}
      <AccordionSection
        title="Brand"
        selectedCount={data.brands.length}
        hidden={data.brandOptions.length === 0}
      >
        <PopularBrandBadges
          brands={data.brandOptions.map(b => ({ code: b.value, name: b.value, count: b.count }))}
          selectedBrands={data.brands}
          onToggle={(code) => toggleArrayFilter("brand", code, data.brands)}
          maxShow={6}
        />
        <SearchableBrandFilter
          brands={data.brandOptions.map(b => ({ code: b.value, name: b.value, count: b.count }))}
          selectedBrands={data.brands}
          onToggle={(code) => toggleArrayFilter("brand", code, data.brands)}
          maxVisible={10}
        />
      </AccordionSection>
      
      {/* Price Section */}
      <AccordionSection
        title="Price"
        selectedCount={(data.priceMin !== null ? 1 : 0) + (data.priceMax !== null ? 1 : 0)}
      >
        <div className="grid grid-cols-2 gap-2">
          <PriceInput
            placeholder="$ Min"
            value={data.priceMin?.toString() ?? ""}
            onChange={(v) => updatePrice("priceMin", v)}
          />
          <PriceInput
            placeholder="$ Max"
            value={data.priceMax?.toString() ?? ""}
            onChange={(v) => updatePrice("priceMax", v)}
          />
        </div>
        {(data.priceMin !== null || data.priceMax !== null) && (
          <button
            type="button"
            onClick={() => router.push(buildUrl({ priceMin: null, priceMax: null }))}
            className="mt-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
          >
            Clear price filter
          </button>
        )}
      </AccordionSection>
      
      {/* Mileage Warranty Section */}
      <AccordionSection
        title="Mileage Warranty"
        selectedCount={data.mileageBand ? 1 : 0}
        hidden={data.mileageOptions.every(o => o.count === 0)}
      >
        <div className="space-y-0.5">
          {data.mileageOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={`${value} miles`}
              checked={data.mileageBand === value}
              count={count}
              onChange={() => setSingleFilter("mileageBand", data.mileageBand === value ? null : value)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Rim Diameter Section (for mixed size searches) */}
      <AccordionSection
        title="Wheel Size"
        selectedCount={data.rimDiameters.length}
        hidden={data.rimDiameterOptions.length <= 1}
      >
        <div className="space-y-0.5">
          {data.rimDiameterOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={`${value}" wheels`}
              checked={data.rimDiameters.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("rimDia", String(value), data.rimDiameters.map(String))}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Overall Diameter Section (for mixed size searches) */}
      <AccordionSection
        title="Tire Height"
        selectedCount={data.overallDiameters.length}
        hidden={data.overallDiameterOptions.length <= 1}
      >
        <div className="space-y-0.5">
          {data.overallDiameterOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              checked={data.overallDiameters.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("overallDia", value, data.overallDiameters)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Speed Rating Section */}
      <AccordionSection
        title="Speed Rating"
        selectedCount={data.speeds.length}
        hidden={data.speedOptions.length === 0}
      >
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {data.speedOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              checked={data.speeds.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("speed", value, data.speeds)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Load Range Section */}
      <AccordionSection
        title="Load Range"
        selectedCount={data.loadRanges.length}
        hidden={data.loadRangeOptions.every(o => o.count === 0)}
      >
        <div className="space-y-0.5">
          {data.loadRangeOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={`Load Range ${value}`}
              checked={data.loadRanges.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("loadRange", value, data.loadRanges)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Features Section */}
      <AccordionSection
        title="Features"
        selectedCount={
          (data.runFlat ? 1 : 0) +
          (data.snowRated ? 1 : 0) +
          (data.allWeather ? 1 : 0)
        }
        hidden={
          data.runFlatCount === 0 &&
          data.snowRatedCount === 0 &&
          data.allWeatherCount === 0
        }
      >
        <div className="space-y-0.5">
          {data.runFlatCount > 0 && (
            <FilterCheckbox
              label="Run-Flat"
              checked={data.runFlat}
              count={data.runFlatCount}
              onChange={() => toggleBooleanFilter("runFlat", data.runFlat)}
            />
          )}
          {/* XL removed from Features - it's shown in Load Range filter instead */}
          {data.snowRatedCount > 0 && (
            <FilterCheckbox
              label="Snow Rated (3PMSF)"
              checked={data.snowRated}
              count={data.snowRatedCount}
              onChange={() => toggleBooleanFilter("snowRated", data.snowRated)}
            />
          )}
          {data.allWeatherCount > 0 && (
            <FilterCheckbox
              label="All Weather"
              checked={data.allWeather}
              count={data.allWeatherCount}
              onChange={() => toggleBooleanFilter("allWeather", data.allWeather)}
            />
          )}
        </div>
      </AccordionSection>
    </div>
  );
}
