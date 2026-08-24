"use client";

/**
 * Pending Quote Claim Handler
 * 
 * Automatically handles pending quote claims after authentication.
 * Should be mounted on pages where users land after login/register.
 * 
 * Checks for pending claim token in sessionStorage and redirects
 * to the claim page if found.
 * 
 * @created 2026-08-24
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { consumePendingClaim } from "@/lib/savedQuotes/pendingClaimStorage";
import { authClient } from "@/lib/auth-client";

export function PendingQuoteClaimHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Only run once per mount
    if (checked) return;
    setChecked(true);

    // Don't process on claim page itself
    if (pathname?.startsWith("/account/claim-quote")) {
      return;
    }

    async function checkPendingClaim() {
      try {
        // Check if user is authenticated
        const session = await authClient.getSession();
        if (!session?.data?.user) {
          return; // Not logged in, nothing to do
        }

        // Check for pending claim
        const pending = consumePendingClaim();
        if (!pending) {
          return; // No pending claim
        }

        console.log("[PendingQuoteClaimHandler] Found pending claim, redirecting...");

        // Redirect to claim page
        const claimUrl = `/account/claim-quote?token=${encodeURIComponent(pending.token)}`;
        router.push(claimUrl);
      } catch (err) {
        console.error("[PendingQuoteClaimHandler] Error:", err);
      }
    }

    // Small delay to ensure auth state is loaded
    const timer = setTimeout(checkPendingClaim, 100);
    return () => clearTimeout(timer);
  }, [checked, pathname, router]);

  // This component renders nothing
  return null;
}
