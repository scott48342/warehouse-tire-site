import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AccountPageClient } from "./AccountPageClient";

/**
 * Account Page (Server Component)
 * 
 * Protected route - redirects to login if not authenticated.
 * Minimal implementation for Phase 1.
 */

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // Get session server-side
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect("/login?returnTo=/account");
  }

  return <AccountPageClient user={session.user} />;
}
