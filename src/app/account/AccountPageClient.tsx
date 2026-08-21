"use client";

/**
 * Account Page Client Component
 * 
 * Minimal account landing page for Phase 1.
 * Shows user info and sign out button.
 */

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

interface User {
  id: string;
  email: string;
  name?: string | null;
  emailVerified: boolean;
}

export function AccountPageClient({ user }: { user: User }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[account] Sign out error:", err);
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-[80vh] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-8">My Account</h1>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Signed in as</p>
              <p className="font-semibold text-neutral-900">{user.email}</p>
              {!user.emailVerified && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Email not verified
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">📦</span>
              <h2 className="text-lg font-bold text-neutral-900">My Orders</h2>
            </div>
            <p className="text-neutral-500 text-sm">Coming soon</p>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">🚗</span>
              <h2 className="text-lg font-bold text-neutral-900">My Garage</h2>
            </div>
            <p className="text-neutral-500 text-sm">Coming soon</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full md:w-auto px-6 py-3 rounded-xl border border-neutral-300 text-neutral-700 font-bold hover:bg-neutral-50 disabled:opacity-50 transition-colors"
        >
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
