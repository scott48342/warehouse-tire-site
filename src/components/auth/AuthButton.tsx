"use client";

/**
 * Auth Button Component
 * 
 * Shows "Sign In" for anonymous users, "My Account" for authenticated users.
 * Used in site header for both desktop and mobile.
 */

import Link from "next/link";
import { useSession } from "@/lib/auth-client";

interface AuthButtonProps {
  variant?: "desktop" | "mobile";
  className?: string;
}

export function AuthButton({ variant = "desktop", className = "" }: AuthButtonProps) {
  const { data: session, isPending } = useSession();

  // Don't render while loading to avoid flash
  if (isPending) {
    return null;
  }

  const isAuthenticated = !!session?.user;

  if (variant === "mobile") {
    return (
      <Link
        href={isAuthenticated ? "/account" : "/login"}
        className={`flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 ${className}`}
      >
        {isAuthenticated ? (
          <>
            <span className="mr-1.5">👤</span>
            Account
          </>
        ) : (
          "Sign In"
        )}
      </Link>
    );
  }

  // Desktop variant
  return (
    <Link
      href={isAuthenticated ? "/account" : "/login"}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors ${className}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
      <span>{isAuthenticated ? "Account" : "Sign In"}</span>
    </Link>
  );
}

/**
 * Compact auth button for mobile header row
 */
export function AuthButtonCompact() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return null;
  }

  const isAuthenticated = !!session?.user;

  return (
    <Link
      href={isAuthenticated ? "/account" : "/login"}
      className="flex items-center justify-center w-9 h-9 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
      aria-label={isAuthenticated ? "My Account" : "Sign In"}
      title={isAuthenticated ? "My Account" : "Sign In"}
    >
      <svg
        className="w-4 h-4 text-neutral-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </Link>
  );
}
