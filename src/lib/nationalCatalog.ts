/** Seasonal catalog mode for the national storefront. */
export const NATIONAL_CHECKOUT_PAUSED = true;

const NATIONAL_HOSTS = new Set([
  "shop.warehousetiredirect.com",
  "warehousetiredirect.com",
  "www.warehousetiredirect.com",
]);

export function isNationalCatalogHost(host: string): boolean {
  return NATIONAL_HOSTS.has(host.toLowerCase().replace(/:\d+$/, ""));
}

export function isNewPaymentEndpoint(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, "");
  return [
    "/api/stripe/create-payment-intent",
    "/api/stripe/create-checkout-session",
    "/api/paypal/create-order",
  ].includes(normalizedPath);
}
