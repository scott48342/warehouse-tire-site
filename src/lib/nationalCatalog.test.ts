import { isNationalCatalogHost, isNewPaymentEndpoint, NATIONAL_CHECKOUT_PAUSED } from "./nationalCatalog";

describe("national catalog mode", () => {
  test("pauses only the national domain", () => {
    expect(NATIONAL_CHECKOUT_PAUSED).toBe(true);
    expect(isNationalCatalogHost("shop.warehousetiredirect.com")).toBe(true);
    expect(isNationalCatalogHost("www.warehousetiredirect.com")).toBe(true);
    expect(isNationalCatalogHost("shop.warehousetire.net")).toBe(false);
    expect(isNationalCatalogHost("local.warehousetire.net")).toBe(false);
    expect(isNationalCatalogHost("warehousetire.net")).toBe(false);
  });

  test("blocks new payments but allows returns and captures", () => {
    expect(isNewPaymentEndpoint("/api/stripe/create-payment-intent")).toBe(true);
    expect(isNewPaymentEndpoint("/api/stripe/create-checkout-session")).toBe(true);
    expect(isNewPaymentEndpoint("/api/paypal/create-order")).toBe(true);
    expect(isNewPaymentEndpoint("/api/paypal/create-order/")).toBe(true);
    expect(isNewPaymentEndpoint("/api/paypal/capture-order")).toBe(false);
    expect(isNewPaymentEndpoint("/api/stripe/webhook")).toBe(false);
  });
});
