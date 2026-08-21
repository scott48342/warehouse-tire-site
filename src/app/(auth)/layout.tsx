import { Suspense } from "react";

/**
 * Auth Pages Layout
 * 
 * Shared layout for authentication pages.
 * Uses Suspense for searchParams handling in client components.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-neutral-200 border-t-neutral-900 rounded-full" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
