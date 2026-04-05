"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

type AutoSubmitInputProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  type?: "text" | "number";
  resetPage?: boolean;
};

export function AutoSubmitInput({
  name,
  defaultValue = "",
  placeholder,
  className = "",
  type = "text",
  resetPage = true,
}: AutoSubmitInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  const handleBlur = useCallback(() => {
    // Only submit if value changed
    if (value === defaultValue) return;
    
    const params = new URLSearchParams(searchParams.toString());
    
    if (value) {
      params.set(name, value);
    } else {
      params.delete(name);
    }
    
    if (resetPage) {
      params.set("page", "1");
    }
    
    router.push(`?${params.toString()}`);
  }, [value, defaultValue, name, resetPage, router, searchParams]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
}
