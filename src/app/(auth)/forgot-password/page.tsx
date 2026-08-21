"use client";

/**
 * Forgot Password Page
 * 
 * Request password reset email.
 * Does NOT reveal whether email exists (security).
 */

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use Better Auth client method for password reset
      // This calls the correct endpoint internally
      await authClient.forgetPassword({
        email,
        redirectTo: "/reset-password",
      });
    } catch (err) {
      // Ignore errors - still show success message for security
      console.error("[forgot-password] Error:", err);
    }

    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
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
            If an account exists for <strong>{email}</strong>, we've sent password reset instructions.
          </p>
          <p className="text-sm text-neutral-500 mb-6">
            The link will expire in 1 hour. Check your spam folder if you don't see it.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-neutral-900">Reset Password</h1>
          <p className="mt-2 text-neutral-600">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-neutral-600 hover:text-neutral-900 underline"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
