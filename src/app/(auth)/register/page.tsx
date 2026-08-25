"use client";

/**
 * Registration Page
 * 
 * New customer account creation.
 * Minimal fields: email, password, confirm password.
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/**
 * Check if returnTo represents a legitimate Saved Quote claim flow.
 * Only trust internal claim-quote routes, not arbitrary external URLs.
 */
function isSavedQuoteClaimFlow(returnTo: string): boolean {
  // Must be an internal path starting with /account/claim-quote
  // Decode once to handle URL encoding
  try {
    const decoded = decodeURIComponent(returnTo);
    return decoded.startsWith("/account/claim-quote");
  } catch {
    return false;
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/account";
  
  // Detect Save Quote claim context for contextual messaging
  const isQuoteClaimFlow = isSavedQuoteClaimFlow(returnTo);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Validate password strength (min 8 chars)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name: email.split("@")[0], // Use email prefix as default name
      });

      if (result.error) {
        // Handle specific errors
        if (result.error.message?.includes("already exists") || result.error.code === "USER_ALREADY_EXISTS") {
          setError("An account with this email already exists. Please sign in instead.");
        } else {
          setError(result.error.message || "Registration failed. Please try again.");
        }
        setLoading(false);
        return;
      }

      // Success - show verification message
      setSuccess(true);
    } catch (err) {
      console.error("[register] Error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <span className="text-5xl">📧</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 mb-4">
            Check Your Email
          </h1>
          <p className="text-neutral-600 mb-6">
            We've sent a verification link to <strong>{email}</strong>.
            <br />
            Click the link to verify your email and activate your account.
          </p>
          <p className="text-sm text-neutral-500">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              onClick={() => {
                setSuccess(false);
                setLoading(false);
              }}
              className="text-neutral-900 underline hover:no-underline"
            >
              try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {isQuoteClaimFlow ? (
            // Contextual messaging for Save Quote flow
            <>
              <h1 className="text-3xl font-extrabold text-neutral-900">Create your account to save this quote</h1>
              <p className="mt-2 text-neutral-600">
                Your setup is waiting. Create a free account and access it anytime.
              </p>
            </>
          ) : (
            // Normal registration messaging
            <>
              <h1 className="text-3xl font-extrabold text-neutral-900">Create Account</h1>
              <p className="mt-2 text-neutral-600">
                Join Warehouse Tire Direct for faster checkout and order tracking.
              </p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-neutral-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full h-12 px-4 rounded-xl border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-neutral-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full h-12 px-4 rounded-xl border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none transition-colors"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-neutral-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full h-12 px-4 rounded-xl border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-xs text-neutral-500 text-center">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="underline hover:no-underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:no-underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        {/* Account value proposition */}
        <div className="mt-6 text-center">
          <p className="text-xs text-neutral-400">
            Save your vehicles, quotes & orders in one place.
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-neutral-600">
            Already have an account?{" "}
            <Link
              href={`/login${returnTo !== "/account" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
              className="font-semibold text-neutral-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
