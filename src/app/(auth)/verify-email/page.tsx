"use client";

/**
 * Email Verification Page
 * 
 * Handles email verification token from registration email.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid verification link. Please check your email for the correct link.");
      return;
    }

    const verifyEmail = async () => {
      try {
        // Use fetch directly for email verification
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          method: "GET",
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setStatus("error");
          if (data.message?.includes("expired")) {
            setError("This verification link has expired. Please sign in and request a new verification email.");
          } else if (data.message?.includes("already verified")) {
            // Treat as success
            setStatus("success");
          } else {
            setError(data.message || "Verification failed. Please try again.");
          }
          return;
        }

        setStatus("success");
      } catch (err) {
        console.error("[verify-email] Error:", err);
        setStatus("error");
        setError("Something went wrong. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  if (status === "loading") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="animate-spin inline-block w-12 h-12 border-4 border-neutral-200 border-t-neutral-900 rounded-full" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 mb-4">
            Verifying Your Email
          </h1>
          <p className="text-neutral-600">
            Please wait...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <span className="text-5xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 mb-4">
            Verification Failed
          </h1>
          <p className="text-neutral-600 mb-6">
            {error}
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-block px-6 py-3 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-block px-6 py-3 rounded-xl border border-neutral-300 text-neutral-700 font-bold hover:bg-neutral-50 transition-colors"
            >
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <span className="text-5xl">✅</span>
        </div>
        <h1 className="text-2xl font-extrabold text-neutral-900 mb-4">
          Email Verified!
        </h1>
        <p className="text-neutral-600 mb-6">
          Your email has been verified. You can now sign in to your account.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
