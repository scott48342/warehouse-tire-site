/**
 * GA4 + Google Ads standard ecommerce events (client-side, gtag).
 *
 * This is ADDITIVE. It runs ALONGSIDE the existing internal funnel pipeline
 * (FunnelTracker -> /api/analytics/track) and does NOT replace or modify it.
 * All functions no-op safely when window.gtag is unavailable (SSR, blocked,
 * consent denied), so they can never break cart/checkout UX.
 *
 * Events emitted (GA4 standard ecommerce):
 *   - view_item
 *   - add_to_cart
 *   - begin_checkout
 *   - purchase
 *
 * Notes:
 *   - We do NOT emit a separate Google Ads conversion here. The existing
 *     final purchase conversion (GoogleAdsConversion.tsx, AW-410517185/...)
 *     stays the single source of truth for Ads purchase conversions to avoid
 *     double-counting. GA4 events are linked to Google Ads via the GA4<->Ads
 *     link + imported conversions, not by firing a second Ads tag here.
 */

type GtagFn = (...args: unknown[]) => void;

export interface Ga4Item {
  item_id?: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string; // wheel | tire | accessory | package
  price?: number;
  quantity?: number;
}

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const g = (window as unknown as { gtag?: GtagFn }).gtag;
  return typeof g === "function" ? g : null;
}

/** Low-level: fire a gtag event. No-ops when gtag is absent. */
export function gtagEvent(
  eventName: string,
  params?: Record<string, unknown>
): void {
  const gtag = getGtag();
  if (!gtag) return;
  try {
    gtag("event", eventName, params || {});
  } catch {
    /* never throw from analytics */
  }
}

export function ga4ViewItem(params: {
  item: Ga4Item;
  value?: number;
  currency?: string;
}): void {
  const { item, value, currency = "USD" } = params;
  gtagEvent("view_item", {
    currency,
    value: value ?? (item.price ?? 0) * (item.quantity ?? 1),
    items: [item],
  });
}

export function ga4AddToCart(params: {
  items: Ga4Item[];
  value: number;
  currency?: string;
}): void {
  const { items, value, currency = "USD" } = params;
  gtagEvent("add_to_cart", { currency, value, items });
}

export function ga4BeginCheckout(params: {
  items?: Ga4Item[];
  value: number;
  currency?: string;
  coupon?: string;
}): void {
  const { items, value, currency = "USD", coupon } = params;
  gtagEvent("begin_checkout", {
    currency,
    value,
    ...(coupon ? { coupon } : {}),
    ...(items && items.length ? { items } : {}),
  });
}

export function ga4Purchase(params: {
  transactionId: string;
  value: number;
  items?: Ga4Item[];
  currency?: string;
  tax?: number;
  shipping?: number;
  coupon?: string;
}): void {
  const {
    transactionId,
    value,
    items,
    currency = "USD",
    tax,
    shipping,
    coupon,
  } = params;
  gtagEvent("purchase", {
    transaction_id: transactionId,
    currency,
    value,
    ...(typeof tax === "number" ? { tax } : {}),
    ...(typeof shipping === "number" ? { shipping } : {}),
    ...(coupon ? { coupon } : {}),
    ...(items && items.length ? { items } : {}),
  });
}

/**
 * Enhanced Conversions: provide hashed-or-plain identifiers to gtag so Google
 * can match conversions to ad clicks. gtag hashes client-side before sending.
 * Call BEFORE the purchase/conversion event fires. No-ops without gtag.
 *
 * Only include fields actually present; omit empties to avoid noise.
 */
export function ga4SetUserData(data: {
  email?: string | null;
  phone?: string | null; // E.164 preferred, e.g. +13135551234
  firstName?: string | null;
  lastName?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null; // state
  postalCode?: string | null;
  country?: string | null; // ISO-3166 alpha-2, e.g. US
}): void {
  const gtag = getGtag();
  if (!gtag) return;

  const email = (data.email || "").trim().toLowerCase();
  const phone = normalizePhone(data.phone);

  const address: Record<string, string> = {};
  if (data.firstName) address.first_name = data.firstName.trim().toLowerCase();
  if (data.lastName) address.last_name = data.lastName.trim().toLowerCase();
  if (data.street) address.street = data.street.trim().toLowerCase();
  if (data.city) address.city = data.city.trim().toLowerCase();
  if (data.region) address.region = data.region.trim().toLowerCase();
  if (data.postalCode) address.postal_code = data.postalCode.trim();
  address.country = (data.country || "US").trim().toUpperCase();

  const userData: Record<string, unknown> = {};
  if (email) userData.email = email;
  if (phone) userData.phone_number = phone;
  if (Object.keys(address).length > 1) userData.address = address; // >1 means more than just country

  if (!userData.email && !userData.phone_number && !userData.address) return;

  try {
    gtag("set", "user_data", userData);
  } catch {
    /* never throw */
  }
}

/** Best-effort E.164 for US numbers; returns undefined if unusable. */
function normalizePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trim().startsWith("+")) return raw.trim();
  return undefined;
}
