"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* =============================================================================
   TYPES
============================================================================= */

type WheelFilterData = {
  // URL state
  brands: string[];
  finishes: string[];
  diameters: string[];
  widths: string[];
  offsets?: string[];
  priceMin: number | null;
  priceMax: number | null;
  boltPattern: string;
  
  // Available options with counts
  brandOptions: Array<{ code: string; desc: string; count?: number }>;
  finishOptions: Array<{ value: string; count?: number }>;
  diameterOptions: Array<{ value: string; count?: number }>;
  widthOptions: Array<{ value: string; count?: number }>;
  offsetOptions?: Array<{ value: string; count?: number }>;
  boltPatternOptions: Array<{ value: string; count?: number }>;
  
  // Context
  basePath: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  modification: string;
  sort: string;
  fitLevel: string;
  
  // Vehicle bolt pattern (from fitment)
  vehicleBoltPattern?: string;
  
  // Total counts
  totalCount?: number;
};

/* =============================================================================
   CHEVRON ICON (compact)
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
   RANGE INPUT (compact)
============================================================================= */

function RangeInput({
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

export function WheelFilterSidebar({ data }: { data: WheelFilterData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const buildUrl = useCallback((updates: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (data.year) params.set("year", data.year);
    if (data.make) params.set("make", data.make);
    if (data.model) params.set("model", data.model);
    if (data.trim) params.set("trim", data.trim);
    if (data.modification) params.set("modification", data.modification);
    if (data.sort) params.set("sort", data.sort);
    if (data.fitLevel) params.set("fitLevel", data.fitLevel);
    
    for (const [key, value] of Object.entries(updates)) {
      params.delete(key);
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, v);
        }
      } else {
        params.set(key, value);
      }
    }
    
    params.set("page", "1");
    return `${data.basePath}?${params.toString()}`;
  }, [searchParams, data]);
  
  const navigate = useCallback((updates: Record<string, string | string[] | null>) => {
    router.push(buildUrl(updates));
  }, [router, buildUrl]);
  
  const toggleArrayFilter = useCallback((key: string, currentValues: string[], value: string) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    navigate({ [key]: newValues });
  }, [navigate]);
  
  const clearAllUrl = buildUrl({
    brand_cd: null,
    finish: null,
    diameter: null,
    width: null,
    offset: null,
    priceMin: null,
    priceMax: null,
    boltPattern: null,
  });
  
  const activeFilterCount = 
    data.brands.length +
    data.finishes.length +
    data.diameters.length +
    data.widths.length +
    (data.offsets?.length || 0) +
    (data.priceMin ? 1 : 0) +
    (data.priceMax ? 1 : 0) +
    (data.boltPattern ? 1 : 0);

  return (
    <div className="text-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900">Filters</h2>
        {activeFilterCount > 0 && (
          <a 
            href={clearAllUrl}
            className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800 hover:underline transition-colors"
          >
            Clear ({activeFilterCount})
          </a>
        )}
      </div>
      
      {/* Bolt Pattern - Vehicle spec */}
      {data.vehicleBoltPattern && (
        <div className="py-2 border-b border-neutral-100">
          <div className="rounded-lg bg-green-50 border border-green-100 px-2.5 py-1.5">
            <div className="text-[11px] text-green-600">Vehicle bolt pattern</div>
            <div className="text-[13px] font-semibold text-green-700">✓ {data.vehicleBoltPattern}</div>
          </div>
        </div>
      )}
      
      {/* Bolt Pattern Filter */}
      <AccordionSection
        title="Bolt Pattern"
        selectedCount={data.boltPattern ? 1 : 0}
        hidden={data.boltPatternOptions.length <= 1}
      >
        <div className="max-h-36 overflow-y-auto scroll-smooth">
          {data.boltPatternOptions.map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={opt.value}
              checked={data.boltPattern === opt.value}
              count={opt.count}
              onChange={(checked) => navigate({ boltPattern: checked ? opt.value : null })}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Brand - show 5 initially */}
      <AccordionSection
        title="Brand"
        defaultOpen
        selectedCount={data.brands.length}
      >
        <div className="max-h-48 overflow-y-auto scroll-smooth">
          {data.brandOptions.slice(0, 5).map((brand) => (
            <FilterCheckbox
              key={brand.code}
              label={brand.desc}
              checked={data.brands.includes(brand.code)}
              count={brand.count}
              onChange={() => toggleArrayFilter("brand_cd", data.brands, brand.code)}
            />
          ))}
          {data.brandOptions.length > 5 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-medium text-neutral-500 hover:text-neutral-800 py-1">
                +{data.brandOptions.length - 5} more
              </summary>
              <div className="mt-1">
                {data.brandOptions.slice(5).map((brand) => (
                  <FilterCheckbox
                    key={brand.code}
                    label={brand.desc}
                    checked={data.brands.includes(brand.code)}
                    count={brand.count}
                    onChange={() => toggleArrayFilter("brand_cd", data.brands, brand.code)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </AccordionSection>
      
      {/* Diameter */}
      <AccordionSection
        title="Diameter"
        defaultOpen
        selectedCount={data.diameters.length}
      >
        <div className="max-h-36 overflow-y-auto scroll-smooth">
          {data.diameterOptions.map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={`${String(opt.value).replace(/\.0$/, "")}"`}
              checked={data.diameters.includes(opt.value)}
              count={opt.count}
              onChange={() => toggleArrayFilter("diameter", data.diameters, opt.value)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Price */}
      <AccordionSection
        title="Price"
        selectedCount={(data.priceMin ? 1 : 0) + (data.priceMax ? 1 : 0)}
      >
        <div className="grid grid-cols-2 gap-2">
          <RangeInput
            placeholder="Min"
            value={data.priceMin?.toString() ?? ""}
            onChange={(v) => navigate({ priceMin: v || null })}
          />
          <RangeInput
            placeholder="Max"
            value={data.priceMax?.toString() ?? ""}
            onChange={(v) => navigate({ priceMax: v || null })}
          />
        </div>
        {(data.priceMin || data.priceMax) && (
          <button
            type="button"
            onClick={() => navigate({ priceMin: null, priceMax: null })}
            className="mt-1.5 text-[11px] text-neutral-500 hover:text-neutral-800 hover:underline"
          >
            Clear
          </button>
        )}
      </AccordionSection>
      
      {/* Finish - show 5 initially */}
      <AccordionSection
        title="Finish"
        selectedCount={data.finishes.length}
      >
        <div className="max-h-48 overflow-y-auto scroll-smooth">
          {data.finishOptions.slice(0, 5).map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={opt.value}
              checked={data.finishes.includes(opt.value)}
              count={opt.count}
              onChange={() => toggleArrayFilter("finish", data.finishes, opt.value)}
            />
          ))}
          {data.finishOptions.length > 5 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-medium text-neutral-500 hover:text-neutral-800 py-1">
                +{data.finishOptions.length - 5} more
              </summary>
              <div className="mt-1">
                {data.finishOptions.slice(5).map((opt) => (
                  <FilterCheckbox
                    key={opt.value}
                    label={opt.value}
                    checked={data.finishes.includes(opt.value)}
                    count={opt.count}
                    onChange={() => toggleArrayFilter("finish", data.finishes, opt.value)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </AccordionSection>
      
      {/* Width */}
      <AccordionSection
        title="Width"
        selectedCount={data.widths.length}
      >
        <div className="max-h-36 overflow-y-auto scroll-smooth">
          {data.widthOptions.map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={`${opt.value}"`}
              checked={data.widths.includes(opt.value)}
              count={opt.count}
              onChange={() => toggleArrayFilter("width", data.widths, opt.value)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Offset */}
      <AccordionSection
        title="Offset"
        selectedCount={(data.offsets || []).length}
        hidden={!data.offsetOptions || data.offsetOptions.length === 0}
      >
        <div className="max-h-36 overflow-y-auto scroll-smooth">
          {(data.offsetOptions || []).map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={`${Number(opt.value) >= 0 ? "+" : ""}${opt.value}mm`}
              checked={(data.offsets || []).includes(opt.value)}
              count={opt.count}
              onChange={() => toggleArrayFilter("offset", data.offsets || [], opt.value)}
            />
          ))}
        </div>
      </AccordionSection>
    </div>
  );
}
