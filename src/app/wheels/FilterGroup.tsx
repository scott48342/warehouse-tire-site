import type React from "react";

export function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="text-xs font-extrabold text-neutral-900">{title}</div>
      <div className="mt-2 grid gap-2">{children}</div>
    </div>
  );
}
