/**
 * Cart Recovery Page
 * 
 * Restores an abandoned cart when user clicks recovery link from email.
 * 
 * Flow:
 * 1. Fetch cart data from database
 * 2. Validate cart exists and is not expired
 * 3. Pass cart data to client component
 * 4. Client restores items to localStorage cart
 * 5. Redirect to cart/checkout page
 * 
 * @created 2026-03-25
 */

import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";
import { CartRestorer } from "./CartRestorer";
import { markRecoveredAfterEmail } from "@/lib/cart/abandonedCartEmail";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ cartId: string }>;
}

export default async function CartRecoverPage({ params }: PageProps) {
  const { cartId } = await params;

  if (!cartId) {
    notFound();
  }

  // Fetch cart from database
  const cart = await db.query.abandonedCarts.findFirst({
    where: eq(abandonedCarts.cartId, cartId),
  });

  if (!cart) {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">🛒</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Cart Not Found</h1>
          <p className="text-neutral-600 mb-6">
            This cart link may have expired or the cart was already completed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-12 px-6 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
          >
            Start Shopping
          </Link>
        </div>
      </main>
    );
  }

  // Check if cart is expired
  if (cart.status === "expired") {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Cart Expired</h1>
          <p className="text-neutral-600 mb-6">
            This cart has expired. Items may no longer be available at the same prices.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-12 px-6 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
          >
            Start Fresh
          </Link>
        </div>
      </main>
    );
  }

  // Check if already recovered
  if (cart.status === "recovered") {
    return (
      <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Order Completed</h1>
          <p className="text-neutral-600 mb-6">
            Great news! This order has already been completed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-12 px-6 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </main>
    );
  }

  // Prepare cart items for restoration
  const items = Array.isArray(cart.items) ? cart.items : [];
  const totalValue = Number(cart.estimatedTotal) || 0;
  
  const vehicleLabel = cart.vehicleYear
    ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}${cart.vehicleTrim ? ` ${cart.vehicleTrim}` : ""}`
    : null;

  // Track that this recovery came from email
  if (cart.firstEmailSentAt || cart.secondEmailSentAt) {
    await markRecoveredAfterEmail(cartId);
  }

  return (
    <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🛒</div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Welcome Back!</h1>
          <p className="text-neutral-600">
            We saved your cart. Let's get you back on track.
          </p>
        </div>

        {/* Cart Summary Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {vehicleLabel && (
            <div className="bg-neutral-50 rounded-xl p-4 mb-4">
              <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Your Vehicle</div>
              <div className="text-lg font-semibold text-neutral-900">🚗 {vehicleLabel}</div>
            </div>
          )}

          <div className="flex justify-between items-center py-3 border-b border-neutral-100">
            <span className="text-neutral-600">Items in cart</span>
            <span className="font-semibold text-neutral-900">{cart.itemCount} items</span>
          </div>

          <div className="flex justify-between items-center pt-3">
            <span className="text-neutral-600">Estimated total</span>
            <span className="text-2xl font-bold text-red-600">
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Restorer Component (handles client-side cart restoration) */}
        <CartRestorer cartId={cartId} items={items} />

        {/* Help text */}
        <p className="text-center text-sm text-neutral-500 mt-6">
          Questions? Call us or reply to the email you received.
        </p>
      </div>
    </main>
  );
}
