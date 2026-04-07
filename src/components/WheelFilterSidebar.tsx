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
   RANGE INPUT WITH DEBOUNCE
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
      className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
    />
  );
}

/* =============================================================================
   MAIN SIDEBAR COMPONENT
============================================================================= */

export function WheelFilterSidebar({ data }: { data: WheelFilterData }) {
  const router = useRouter();
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
    if (data.sort) params.set("sort", data.sort);
    if (data.fitLevel) params.set("fitLevel", data.fitLevel);
    
    // Apply updates
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
    
    // Reset to page 1 when filters change
    params.set("page", "1");
    
    return `${data.basePath}?${params.toString()}`;
  }, [searchParams, data]);
  
  // Navigate with updated filters
  const navigate = useCallback((updates: Record<string, string | string[] | null>) => {
    router.push(buildUrl(updates));
  }, [router, buildUrl]);
  
  // Toggle array filter value
  const toggleArrayFilter = useCallback((key: string, currentValues: string[], value: string) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    navigate({ [key]: newValues });
  }, [navigate]);
  
  // Clear all filters
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-extrabold text-neutral-900">Filters</h2>
        <a 
          href={clearAllUrl}
          className="text-sm font-semibold text-neutral-500 hover:text-neutral-700 hover:underline"
        >
          Clear all
        </a>
      </div>
      
      {/* Bolt Pattern - Show vehicle spec if available */}
      {data.vehicleBoltPattern && (
        <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <div className="text-xs text-green-600">Vehicle bolt pattern</div>
          <div className="text-sm font-bold text-green-800">✓ {data.vehicleBoltPattern}</div>
        </div>
      )}
      
      {/* Bolt Pattern Filter - only show if multiple options */}
      <AccordionSection
        title="Bolt Pattern"
        defaultOpen={false}
        selectedCount={data.boltPattern ? 1 : 0}
        hidden={data.boltPatternOptions.length <= 1}
      >
        <div className="max-h-48 overflow-y-auto space-y-0.5">
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
      
      {/* Brand */}
      <AccordionSection
        title="Brand"
        defaultOpen={true}
        selectedCount={data.brands.length}
      >
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {data.brandOptions.slice(0, 30).map((brand) => (
            <FilterCheckbox
              key={brand.code}
              label={brand.desc}
              checked={data.brands.includes(brand.code)}
              count={brand.count}
              onChange={() => toggleArrayFilter("brand_cd", data.brands, brand.code)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Diameter */}
      <AccordionSection
        title="Diameter"
        defaultOpen={true}
        selectedCount={data.diameters.length}
      >
        <div className="max-h-48 overflow-y-auto space-y-0.5">
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
        defaultOpen={false}
        selectedCount={(data.priceMin ? 1 : 0) + (data.priceMax ? 1 : 0)}
      >
        <div className="grid grid-cols-2 gap-2">
          <RangeInput
            placeholder="$ min"
            value={data.priceMin?.toString() ?? ""}
            onChange={(v) => navigate({ priceMin: v || null })}
          />
          <RangeInput
            placeholder="$ max"
            value={data.priceMax?.toString() ?? ""}
            onChange={(v) => navigate({ priceMax: v || null })}
          />
        </div>
      </AccordionSection>
      
      {/* Finish */}
      <AccordionSection
        title="Finish"
        defaultOpen={false}
        selectedCount={data.finishes.length}
      >
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {data.finishOptions.slice(0, 30).map((opt) => (
            <FilterCheckbox
              key={opt.value}
              label={opt.value}
              checked={data.finishes.includes(opt.value)}
              count={opt.count}
              onChange={() => toggleArrayFilter("finish", data.finishes, opt.value)}
            />
          ))}
        </div>
      </AccordionSection>
      
      {/* Width */}
      <AccordionSection
        title="Width"
        defaultOpen={false}
        selectedCount={data.widths.length}
      >
        <div className="max-h-48 overflow-y-auto space-y-0.5">
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
        title="Offset (mm)"
        defaultOpen={false}
        selectedCount={(data.offsets || []).length}
        hidden={!data.offsetOptions || data.offsetOptions.length === 0}
      >
        <div className="max-h-48 overflow-y-auto space-y-0.5">
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
