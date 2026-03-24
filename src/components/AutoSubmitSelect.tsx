"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
  resetPage = false,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
  /** Reset page to 1 when value changes (useful for filters) */
  resetPage?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        const val = e.currentTarget.value;
        
        // If empty value, remove the param entirely (cleaner URLs)
        if (val === "") {
          next.delete(name);
        } else {
          next.set(name, val);
        }
        
        // Reset to page 1 when filter changes
        if (resetPage) {
          next.set("page", "1");
        }
        
        router.push(`${pathname}?${next.toString()}`);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
