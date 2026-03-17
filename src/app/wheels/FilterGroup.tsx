import type React from "react";

export function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div className="text-sm font-extrabold text-neutral-900">{title}</div>
      <div className="mt-3 grid gap-3">{children}</div>
    </div>
  );
}
