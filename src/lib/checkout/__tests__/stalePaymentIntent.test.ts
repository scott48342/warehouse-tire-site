/**
 * @jest-environment node
 *
 * Pure helpers behind the stale PaymentIntent fix (Codex review 2026-09-20).
 */
import { paymentIntentInputKey } from "@/lib/checkout/paymentIntentInputs";

describe("paymentIntentInputKey", () => {
  const base = {
    items: [{ type: "wheel", sku: "652-2865GBD", rearSku: "652-2165GBD", quantity: 4, unitPrice: 340.77, frontUnitPrice: 336.12, rearUnitPrice: 345.41 }],
    shipping: { address: "1 Main St", address2: "", city: "Pontiac", state: "MI", zip: "48340", email: "t@example.com" },
    isLocal: false,
    selectedStore: null,
    discountCode: null,
  };
  it("is stable across renders, item order, case and whitespace", () => {
    const a = paymentIntentInputKey(base);
    expect(paymentIntentInputKey({ ...base, items: [...base.items] })).toBe(a);
    expect(paymentIntentInputKey({ ...base, shipping: { ...base.shipping, city: " pontiac ", state: "mi", email: "T@Example.com" } })).toBe(a);
    const two = { ...base, items: [base.items[0], { type: "tire", sku: "T1", quantity: 4, unitPrice: 100 }] };
    expect(paymentIntentInputKey(two)).toBe(paymentIntentInputKey({ ...two, items: [two.items[1], two.items[0]] }));
  });
  it("changes for anything that prices the order", () => {
    const a = paymentIntentInputKey(base);
    expect(paymentIntentInputKey({ ...base, items: [{ ...base.items[0], quantity: 5 }] })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, items: [{ ...base.items[0], rearSku: "652-2165MB" }] })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, items: [{ ...base.items[0], rearUnitPrice: 300 }] })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, items: [] })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, shipping: { ...base.shipping, state: "CO", zip: "80202" } })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, shipping: { ...base.shipping, zip: "48341" } })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, shipping: { ...base.shipping, address: "2 Main St" } })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, shipping: { ...base.shipping, email: "other@example.com" } })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, discountCode: "WELCOME10" })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, isLocal: true, selectedStore: "pontiac" })).not.toBe(a);
  });
});
