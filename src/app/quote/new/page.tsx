import { redirect } from "next/navigation";

/**
 * Legacy quote builder page - redirects to cart.
 * The site now uses cart-based checkout only.
 */
export default function QuoteNewPage() {
  redirect("/cart");
}
