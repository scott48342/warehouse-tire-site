"use client";

export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className={className}
      type="button"
    >
      Print
    </button>
  );
}
