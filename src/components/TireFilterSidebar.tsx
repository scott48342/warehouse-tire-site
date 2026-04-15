"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import type { TreadCategory, MileageBand } from "@/lib/tires/normalization";
import { TireTypesGuide } from "@/components/BuyingGuides";

/* =============================================================================
   TYPES
============================================================================= */

type TreadwearRange = '300-400' | '400-500' | '500-600' | '600+';

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
  studdable: boolean;
  treadwearRanges: TreadwearRange[];
  
  // New size-based filters
  rimDiameters: number[];
  overallDiameters: string[];
  
  // Available options with counts
  brandOptions: Array<{ value: string; count: number }>;
  treadCategoryOptions: Array<{ value: TreadCategory; count: number }>;
  speedOptions: Array<{ value: string; count: number }>;
  loadRangeOptions: Array<{ value: string; count: number }>;
  mileageOptions: Array<{ value: MileageBand; count: number }>;
  treadwearOptions: Array<{ value: TreadwearRange; label: string; count: number }>;
  
  // New size-based options
  rimDiameterOptions: Array<{ value: number; count: number }>;
  overallDiameterOptions: Array<{ value: string; count: number }>;
  
  // Feature counts
  runFlatCount: number;
  snowRatedCount: number;
  allWeatherCount: number;
  xlCount: number;
  studdableCount: number;
  
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
   CHEVRON ICON (smaller)
============================================================================= */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/* =============================================================================
   ACCORDION SECTION (compact)
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
        className="flex w-full items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-neutral-800">{title}</span>
          {selectedCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-800 px-1 text-[9px] font-bold text-white">
              {selectedCount}
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && <div className="pb-2.5">{children}</div>}
    </div>
  );
}

/* =============================================================================
   FILTER CHECKBOX (tight rows)
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
      className="flex w-full cursor-pointer items-center justify-between gap-2 py-[3px] hover:bg-neutral-50 -mx-1.5 px-1.5 rounded transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors ${
            checked
              ? "border-neutral-800 bg-neutral-800"
              : "border-neutral-300 bg-white"
          }`}
        >
          {checked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-[13px] text-neutral-700">{label}</span>
      </div>
      {typeof count === "number" && (
        <span className="text-[11px] text-neutral-400">{count}</span>
      )}
    </button>
  );
}

/* =============================================================================
   PRICE INPUT (compact)
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
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 500);
  };
  
  const handleBlur = () => {
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
      className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
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
  
  const buildUrl = useCallback((updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (data.year) params.set("year", data.year);
    if (data.make) params.set("make", data.make);
    if (data.model) params.set("model", data.model);
    if (data.trim) params.set("trim", data.trim);
    if (data.modification) params.set("modification", data.modification);
    if (data.selectedSize) params.set("size", data.selectedSize);
    if (data.sort) params.set("sort", data.sort);
    if (data.wheelSku) params.set("wheelSku", data.wheelSku);
    if (data.wheelDia) params.set("wheelDia", data.wheelDia);
    
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
    
    params.delete("page");
    return `${data.basePath}?${params.toString()}`;
  }, [searchParams, data]);
  
  const toggleArrayFilter = useCallback((key: string, value: string, currentValues: string[]) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    router.push(buildUrl({ [key]: newValues }));
  }, [router, buildUrl]);
  
  const toggleBooleanFilter = useCallback((key: string, currentValue: boolean) => {
    router.push(buildUrl({ [key]: currentValue ? null : "1" }));
  }, [router, buildUrl]);
  
  const setSingleFilter = useCallback((key: string, value: string | null) => {
    router.push(buildUrl({ [key]: value }));
  }, [router, buildUrl]);
  
  const updatePrice = useCallback((minOrMax: "priceMin" | "priceMax", value: string) => {
    router.push(buildUrl({ [minOrMax]: value || null }));
  }, [router, buildUrl]);
  
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
    studdable: null,
    treadwear: null,
    rimDia: null,
    overallDia: null,
  });
  
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
    (data.studdable ? 1 : 0) +
    data.treadwearRanges.length +
    data.rimDiameters.length +
    data.overallDiameters.length;

  return (
    <div className="text-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900">Filters</h2>
        {activeFilterCount > 0 && (
          <Link
            href={clearAllUrl}
            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 hover:underline transition-colors"
          >
            Clear ({activeFilterCount})
          </Link>
        )}
      </div>
      
      {/* Availability - inline, not accordion */}
      {data.inStockCount !== undefined && (
        <div className="py-2 border-b border-neutral-100 text-[13px] text-neutral-600">
          <span className="font-medium text-green-600">{data.inStockCount}</span> in stock
          {data.totalCount !== undefined && data.totalCount > data.inStockCount && (
            <span className="text-neutral-400"> of {data.totalCount}</span>
          )}
        </div>
      )}
      
      {/* Rebates - compact */}
      <div className="py-2 border-b border-neutral-100">
        <Link 
          href="/rebates"
          className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2 hover:bg-emerald-100 transition-colors"
        >
          <span className="text-sm">💰</span>
          <div className="text-[12px]">
            <span className="font-semibold text-emerald-700">Rebates</span>
            <span className="text-emerald-600"> · Save up to $100</span>
          </div>
        </Link>
      </div>
      
      {/* Category */}
      <AccordionSection
        title="Category"
        defaultOpen
        selectedCount={data.treadCategories.length}
        hidden={data.treadCategoryOptions.length === 0}
      >
        <div>
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
        <div className="mt-2 pt-2 border-t border-neutral-100">
          <TireTypesGuide variant="link" />
        </div>
      </AccordionSection>
      
      {/* Brand - show 5 initially */}
      <AccordionSection
        title="Brand"
        defaultOpen={data.brands.length > 0}
        selectedCount={data.brands.length}
        hidden={data.brandOptions.length === 0}
      >
        <div className="max-h-48 overflow-y-auto scroll-smooth">
          {data.brandOptions.slice(0, 5).map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              checked={data.brands.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("brand", value, data.brands)}
            />
          ))}
          {data.brandOptions.length > 5 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-medium text-neutral-500 hover:text-neutral-800 py-1">
                +{data.brandOptions.length - 5} more
              </summary>
              <div className="mt-1">
                {data.brandOptions.slice(5).map(({ value, count }) => (
                  <FilterCheckbox
                    key={value}
                    label={value}
                    checked={data.brands.includes(value)}
                    count={count}
                    onChange={() => toggleArrayFilter("brand", value, data.brands)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </AccordionSection>
      
      {/* Price */}
      <AccordionSection
        title="Price"
        selectedCount={(data.priceMin !== null ? 1 : 0) + (data.priceMax !== null ? 1 : 0)}
      >
        <div className="grid grid-cols-2 gap-2">
          <PriceInput
            placeholder="Min"
            value={data.priceMin?.toString() ?? ""}
            onChange={(v) => updatePrice("priceMin", v)}
          />
          <PriceInput
            placeholder="Max"
            value={data.priceMax?.toString() ?? ""}
            onChange={(v) => updatePrice("priceMax", v)}
          />
        </div>
        {(data.priceMin !== null || data.priceMax !== null) && (
          <button
            type="button"
            onClick={() => router.push(buildUrl({ priceMin: null, priceMax: null }))}
            className="mt-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 hover:underline"
          >
            Clear
          </button>
        )}
      </AccordionSection>
      
      {/* Mileage */}
      <AccordionSection
        title="Mileage Warranty"
        selectedCount={data.mileageBand ? 1 : 0}
        hidden={data.mileageOptions.every(o => o.count === 0)}
      >
        <div>
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
      
      {/* Treadwear */}
      <AccordionSection
        title="Treadwear"
        selectedCount={data.treadwearRanges.length}
        hidden={!data.treadwearOptions || data.treadwearOptions.every(o => o.count === 0)}
      >
        <div>
          {data.treadwearOptions?.map(({ value, label, count }) => (
            <FilterCheckbox
              key={value}
              label={label}
              checked={data.treadwearRanges.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("treadwear", value, data.treadwearRanges)}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-400">
          Higher = longer life
        </p>
      </AccordionSection>
      
      {/* Wheel Size */}
      <AccordionSection
        title="Wheel Size"
        selectedCount={data.rimDiameters.length}
        hidden={data.rimDiameterOptions.length <= 1}
      >
        <div>
          {data.rimDiameterOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={`${value}"`}
              checked={data.rimDiameters.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("rimDia", String(value), data.rimDiameters.map(String))}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Tire Height */}
      <AccordionSection
        title="Tire Height"
        selectedCount={data.overallDiameters.length}
        hidden={data.overallDiameterOptions.length <= 1}
      >
        <div>
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
      
      {/* Speed Rating */}
      <AccordionSection
        title="Speed Rating"
        selectedCount={data.speeds.length}
        hidden={data.speedOptions.length === 0}
      >
        <div className="max-h-36 overflow-y-auto scroll-smooth">
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
      
      {/* Load Range */}
      <AccordionSection
        title="Load Range"
        selectedCount={data.loadRanges.length}
        hidden={data.loadRangeOptions.every(o => o.count === 0)}
      >
        <div>
          {data.loadRangeOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={`Range ${value}`}
              checked={data.loadRanges.includes(value)}
              count={count}
              onChange={() => toggleArrayFilter("loadRange", value, data.loadRanges)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Features */}
      <AccordionSection
        title="Features"
        selectedCount={
          (data.runFlat ? 1 : 0) +
          (data.snowRated ? 1 : 0) +
          (data.allWeather ? 1 : 0) +
          (data.studdable ? 1 : 0)
        }
        hidden={
          data.runFlatCount === 0 &&
          data.snowRatedCount === 0 &&
          data.allWeatherCount === 0 &&
          data.studdableCount === 0
        }
      >
        <div>
          {data.runFlatCount > 0 && (
            <FilterCheckbox
              label="Run-Flat"
              checked={data.runFlat}
              count={data.runFlatCount}
              onChange={() => toggleBooleanFilter("runFlat", data.runFlat)}
            />
          )}
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
          {data.studdableCount > 0 && (
            <FilterCheckbox
              label="Studdable"
              checked={data.studdable}
              count={data.studdableCount}
              onChange={() => toggleBooleanFilter("studdable", data.studdable)}
            />
          )}
        </div>
      </AccordionSection>
    </div>
  );
}
