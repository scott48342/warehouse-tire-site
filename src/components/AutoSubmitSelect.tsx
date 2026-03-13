"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
}: {
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
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
        next.set(name, e.currentTarget.value);
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
