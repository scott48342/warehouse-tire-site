/**
 * @jest-environment node
 *
 * Pure helpers behind the stale PaymentIntent fix (Codex review 2026-09-20).
 */
import { paidAmountMismatch } from "@/lib/checkout/paidAmountGuard";
import { cancelSupersededPaymentIntent } from "@/lib/checkout/supersededPaymentIntent";
import { paymentIntentInputKey } from "@/lib/checkout/paymentIntentInputs";

const quiet = { warn: () => {}, log: () => {} };

describe("paidAmountMismatch", () => {
  it("null when equal, legacy (no expectation), or expectation not a finite number", () => {
    expect(paidAmountMismatch({ expectedChargeCents: 140259 }, 140259)).toBeNull();
    expect(paidAmountMismatch({}, 1)).toBeNull();
    expect(paidAmountMismatch(null, 1)).toBeNull();
    expect(paidAmountMismatch({ expectedChargeCents: null }, 1)).toBeNull();
    expect(paidAmountMismatch({ expectedChargeCents: NaN }, 1)).toBeNull();
  });
  it("mismatch on any difference, and on a missing/non-numeric paid amount", () => {
    expect(paidAmountMismatch({ expectedChargeCents: 140259 }, 140258)).toEqual({ expectedCents: 140259, paidCents: 140258 });
    expect(paidAmountMismatch({ expectedChargeCents: 140259 }, undefined)).toEqual({ expectedCents: 140259, paidCents: NaN });
    expect(paidAmountMismatch({ expectedChargeCents: 140259 }, "140259")).toEqual({ expectedCents: 140259, paidCents: NaN });
  });
});

describe("cancelSupersededPaymentIntent", () => {
  const mk = (pi: any, cancelImpl?: () => Promise<any>) => {
    const retrieve = jest.fn(async () => pi);
    const cancel = jest.fn(cancelImpl ?? (async () => ({ status: "canceled" })));
    return { stripe: { paymentIntents: { retrieve, cancel } }, retrieve, cancel };
  };
  it("cancels a cart-owned intent that is still awaiting payment", async () => {
    for (const status of ["requires_payment_method", "requires_confirmation", "requires_action"]) {
      const m = mk({ status, metadata: { cartId: "c1" } });
      await expect(cancelSupersededPaymentIntent(m.stripe, "pi_abcdefgh123", "c1", quiet)).resolves.toBe("cancelled");
      expect(m.cancel).toHaveBeenCalledWith("pi_abcdefgh123", { cancellation_reason: "abandoned" });
    }
  });
  it("refuses another cart's intent, an ownerless intent, or a caller without a cartId", async () => {
    for (const [pi, cart] of [
      [{ status: "requires_payment_method", metadata: { cartId: "other" } }, "c1"],
      [{ status: "requires_payment_method", metadata: {} }, "c1"],
      [{ status: "requires_payment_method", metadata: { cartId: "c1" } }, undefined],
    ] as const) {
      const m = mk(pi);
      await expect(cancelSupersededPaymentIntent(m.stripe, "pi_abcdefgh123", cart as any, quiet)).resolves.toBe("refused");
      expect(m.cancel).not.toHaveBeenCalled();
    }
  });
  it("refuses intents that are paid, processing, captured-pending or already cancelled", async () => {
    for (const status of ["succeeded", "processing", "requires_capture", "canceled", undefined]) {
      const m = mk({ status, metadata: { cartId: "c1" } });
      await expect(cancelSupersededPaymentIntent(m.stripe, "pi_abcdefgh123", "c1", quiet)).resolves.toBe("refused");
      expect(m.cancel).not.toHaveBeenCalled();
    }
  });
  it("skips anything that is not a Stripe PaymentIntent id, without calling Stripe", async () => {
    for (const bad of [undefined, null, "", "cs_test", "pi_", "pi_short", 12, {}, "pi_abcdefgh123 ", "pi_abc-def"]) {
      const m = mk({ status: "requires_payment_method", metadata: { cartId: "c1" } });
      await expect(cancelSupersededPaymentIntent(m.stripe, bad, "c1", quiet)).resolves.toBe("skipped");
      expect(m.retrieve).not.toHaveBeenCalled();
    }
  });
  it("reports failed when Stripe throws, never throws itself", async () => {
    const m = mk({ status: "requires_payment_method", metadata: { cartId: "c1" } }, async () => { throw new Error("boom"); });
    await expect(cancelSupersededPaymentIntent(m.stripe, "pi_abcdefgh123", "c1", quiet)).resolves.toBe("failed");
  });
});

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
