/**
 * Claim Quote Page
 * 
 * Handles the guest → authenticated quote claim flow.
 * 
 * URL: /account/claim-quote?token=psq_...
 * 
 * Requirements:
 * - Authenticated Better Auth session
 * - Verified email
 * - Valid, unexpired, unconsumed token
 * 
 * On success: Creates saved quote, redirects to account/returnTo
 * On failure: Shows error with appropriate action
 * 
 * @created 2026-08-24
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { claimPendingQuote } from "@/lib/savedQuotes/pendingQuoteService";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface ClaimQuotePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ClaimQuotePage({ searchParams }: ClaimQuotePageProps) {
  const { token } = await searchParams;
  
  // No token provided
  if (!token) {
    return (
      <ClaimError 
        title="Missing Token"
        message="No quote token was provided."
        showAccountLink
      />
    );
  }
  
  // Basic token format validation
  if (!token.startsWith("psq_") || token.length < 20) {
    return (
      <ClaimError 
        title="Invalid Token"
        message="The quote token format is invalid."
        showAccountLink
      />
    );
  }
  
  // Check authentication
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user) {
    // Not logged in - redirect to login with return URL
    const returnUrl = `/account/claim-quote?token=${encodeURIComponent(token)}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
  }
  
  // Check email verification
  if (!session.user.emailVerified) {
    return (
      <ClaimError 
        title="Email Verification Required"
        message="Please verify your email address before claiming saved quotes."
        showVerifyLink
      />
    );
  }
  
  // Attempt to claim the quote
  const result = await claimPendingQuote(token, session.user.id);
  
  if (!result.ok) {
    // Handle specific error cases
    switch (result.code) {
      case "invalid_token":
        return (
          <ClaimError 
            title="Invalid or Expired Token"
            message="This quote link is invalid or has already been used."
            showAccountLink
          />
        );
      
      case "expired_token":
        return (
          <ClaimError 
            title="Quote Expired"
            message="This quote link has expired. Quotes must be claimed within 24 hours."
            showShopLink
          />
        );
      
      case "already_claimed":
        return (
          <ClaimError 
            title="Already Claimed"
            message="This quote has already been saved to your account."
            showAccountLink
          />
        );
      
      case "limit_reached":
        return (
          <ClaimError 
            title="Quote Limit Reached"
            message={result.error}
            showAccountLink
            retryToken={token}
          />
        );
      
      default:
        return (
          <ClaimError 
            title="Unable to Claim Quote"
            message="Something went wrong. Please try again or contact support."
            showAccountLink
          />
        );
    }
  }
  
  // Success - redirect to account or return URL
  // Add success state via query param
  const successUrl = `${result.returnTo}?quote_claimed=${result.quoteId}`;
  redirect(successUrl);
}

// ============================================================================
// Error Display Component
// ============================================================================

interface ClaimErrorProps {
  title: string;
  message: string;
  showAccountLink?: boolean;
  showShopLink?: boolean;
  showVerifyLink?: boolean;
  retryToken?: string;
}

function ClaimError({ 
  title, 
  message, 
  showAccountLink, 
  showShopLink,
  showVerifyLink,
  retryToken,
}: ClaimErrorProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-5xl">⚠️</span>
        </div>
        
        <h1 className="text-2xl font-bold text-neutral-900 mb-4">{title}</h1>
        
        <p className="text-neutral-600 mb-8">{message}</p>
        
        <div className="space-y-3">
          {showAccountLink && (
            <Link
              href="/account"
              className="block w-full px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Go to My Account
            </Link>
          )}
          
          {showShopLink && (
            <Link
              href="/tires"
              className="block w-full px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Start Shopping
            </Link>
          )}
          
          {showVerifyLink && (
            <Link
              href="/account"
              className="block w-full px-6 py-3 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
            >
              Go to Account Settings
            </Link>
          )}
          
          {retryToken && (
            <div className="pt-4 border-t border-neutral-200">
              <p className="text-sm text-neutral-500 mb-3">
                Remove a saved quote from your account, then:
              </p>
              <Link
                href={`/account/claim-quote?token=${encodeURIComponent(retryToken)}`}
                className="inline-block px-6 py-3 border border-neutral-300 text-neutral-700 font-semibold rounded-xl hover:bg-neutral-50 transition-colors"
              >
                Try Again
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
