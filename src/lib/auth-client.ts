/**
 * Better Auth Client Configuration
 * 
 * Client-side auth utilities for React components.
 * Provides hooks and methods for authentication state management.
 * 
 * Usage:
 *   import { authClient } from "@/lib/auth-client";
 *   
 *   // Sign in
 *   await authClient.signIn.email({ email, password });
 *   
 *   // Sign up
 *   await authClient.signUp.email({ email, password, name });
 *   
 *   // Get session (in component)
 *   const { data: session } = await authClient.getSession();
 * 
 * @created 2026-08-20
 */

import { createAuthClient } from "better-auth/react";

// ============================================================================
// Auth Client Instance
// ============================================================================

/**
 * Better Auth client configured for WTD.
 * 
 * Base URL is determined automatically:
 * - In browser: uses window.location.origin
 * - In SSR: uses NEXT_PUBLIC_BASE_URL or VERCEL_URL
 */
export const authClient = createAuthClient({
  baseURL: getBaseURL(),
});

function getBaseURL(): string {
  // Browser: use current origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  
  // Server: use env vars
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  return "http://localhost:3000";
}

// ============================================================================
// Convenience Exports
// ============================================================================

// Re-export commonly used methods for convenience
// Note: Better Auth client methods may vary by version - check docs for full API
export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;
export const useSession = authClient.useSession;
export const getSession = authClient.getSession;

// ============================================================================
// Types
// ============================================================================

export type Session = Awaited<ReturnType<typeof authClient.getSession>>["data"];
export type User = NonNullable<Session>["user"];
