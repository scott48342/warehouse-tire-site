/**
 * Fingerprint of everything the embedded checkout sends that prices a PaymentIntent
 * (Codex review 2026-09-20: stale PI invalidation on checkout-input changes).
 *
 * The checkout page keys its PaymentIntent on this string: when it changes after an intent
 * exists, the intent (and its quote) is dropped and re-created from the new inputs, so the
 * Payment Element can never confirm an amount the shopper is no longer looking at.
 * Contact-only fields (name, phone) are deliberately excluded: they do not change the charge
 * and would otherwise spawn a new intent per keystroke.
 */
export type PaymentIntentInputItem = {
  type: string;
  sku: string;
  rearSku?: string | null;
  quantity: number;
  unitPrice?: number | null;
  frontUnitPrice?: number | null;
  rearUnitPrice?: number | null;
  frontQty?: number | null;
  rearQty?: number | null;
};

export type PaymentIntentInputs = {
  items: PaymentIntentInputItem[];
  shipping: { address?: string; address2?: string; city?: string; state?: string; zip?: string; email?: string };
  isLocal: boolean;
  selectedStore?: string | null;
  discountCode?: string | null;
  /** Vehicle the cart was built for - fitment-verified pricing/eligibility depends on it. */
  vehicle?: { year?: string | number | null; make?: string | null; model?: string | null; trim?: string | null } | null;
  /** The amount the shopper is being shown; if it moves for any reason the intent is stale. */
  displayedTotal?: number | null;
};

const s = (v: unknown) => String(v ?? "").trim();
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

export function paymentIntentInputKey(input: PaymentIntentInputs): string {
  const items = input.items
    .map((i) => [s(i.type), s(i.sku), s(i.rearSku), Number(i.quantity) || 0, n(i.unitPrice), n(i.frontUnitPrice), n(i.rearUnitPrice), n(i.frontQty), n(i.rearQty)])
    .sort((a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
  const ship = input.shipping || {};
  return JSON.stringify({
    items,
    ship: [s(ship.address).toUpperCase(), s(ship.address2).toUpperCase(), s(ship.city).toUpperCase(), s(ship.state).toUpperCase(), s(ship.zip), s(ship.email).toLowerCase()],
    local: Boolean(input.isLocal),
    store: s(input.selectedStore),
    discount: s(input.discountCode).toUpperCase(),
    vehicle: input.vehicle ? [s(input.vehicle.year), s(input.vehicle.make).toUpperCase(), s(input.vehicle.model).toUpperCase(), s(input.vehicle.trim).toUpperCase()] : null,
    total: n(input.displayedTotal),
  });
}
