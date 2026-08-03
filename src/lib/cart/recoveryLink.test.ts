/**
 * Recovery Link Signing Tests
 *
 * Covers Phase 1 scenario 8: invalid or expired recovery links.
 *
 * @created 2026-08-03
 */

import { signCartToken, verifyCartToken } from "./recoveryLink";

const CART_ID = "mrpj4tcn-20tw6o8e";
const SECRET = "test-secret-that-is-long-enough-123456";

describe("recoveryLink signing", () => {
  const originalSecret = process.env.CART_RECOVERY_LINK_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CART_RECOVERY_LINK_SECRET;
    else process.env.CART_RECOVERY_LINK_SECRET = originalSecret;
  });

  test("valid token round-trips", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    const token = signCartToken(CART_ID, "recover");
    expect(token).toBeTruthy();
    const result = verifyCartToken(CART_ID, token, "recover");
    expect(result.valid).toBe(true);
  });

  test("expired token rejected", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    const past = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const token = signCartToken(CART_ID, "recover", 1000, past); // expired 15 days ago
    const result = verifyCartToken(CART_ID, token, "recover");
    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  test("token for different cart rejected", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    const token = signCartToken("some-other-cart", "recover");
    const result = verifyCartToken(CART_ID, token, "recover");
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  test("recover token cannot be used for optout (purpose binding)", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    const token = signCartToken(CART_ID, "recover");
    const result = verifyCartToken(CART_ID, token, "optout");
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  test("missing token rejected when secret configured", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    const result = verifyCartToken(CART_ID, null, "recover");
    expect(result).toEqual({ valid: false, reason: "missing_token" });
  });

  test("malformed token rejected", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    expect(verifyCartToken(CART_ID, "garbage", "recover").valid).toBe(false);
    expect(verifyCartToken(CART_ID, "123.notahexsig", "recover").valid).toBe(false);
    expect(verifyCartToken(CART_ID, ".", "recover").valid).toBe(false);
  });

  test("tampered expiry rejected", () => {
    process.env.CART_RECOVERY_LINK_SECRET = SECRET;
    const token = signCartToken(CART_ID, "recover")!;
    const [, sig] = token.split(".");
    const tampered = `${Date.now() + 999999999}.${sig}`;
    expect(verifyCartToken(CART_ID, tampered, "recover")).toEqual({
      valid: false,
      reason: "bad_signature",
    });
  });

  test("fails open (legacy) when no secret configured", () => {
    delete process.env.CART_RECOVERY_LINK_SECRET;
    expect(signCartToken(CART_ID, "recover")).toBeNull();
    const result = verifyCartToken(CART_ID, null, "recover");
    expect(result.valid).toBe(true);
    expect(result.reason).toBe("no_secret_configured");
  });
});
