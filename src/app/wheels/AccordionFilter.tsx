"use client";

import { useState } from "react";

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

export function AccordionFilter({
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
