import type pg from "pg";
import { getPayPalCredentials, type PayPalMode } from "@/lib/payments/paypalSettings";

const PAYPAL_API = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
} as const;

export type PayPalClient = {
  mode: PayPalMode;
  clientId: string;
  getAccessToken: () => Promise<string>;
  createOrder: (amount: number, currency: string, quoteId: string, description?: string, returnUrl?: string, cancelUrl?: string) => Promise<{ id: string; approvalUrl: string }>;
  captureOrder: (orderId: string) => Promise<{ id: string; status: string; payer?: any }>;
};

export async function getPayPalClient(db: pg.Pool): Promise<PayPalClient | null> {
  const creds = await getPayPalCredentials(db);
  if (!creds) return null;

  // Extract values for closure (TypeScript can't narrow creds in nested functions)
  const clientId = creds.clientId;
  const clientSecret = creds.clientSecret;
  const mode = creds.mode;
  const baseUrl = PAYPAL_API[mode];

  // Cache access token (they last ~9 hours but we'll refresh more often)
  let cachedToken: { token: string; expiresAt: number } | null = null;

  async function getAccessToken(): Promise<string> {
    // Return cached if still valid (with 5 min buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
      return cachedToken.token;
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal auth failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };

    return cachedToken.token;
  }

  async function createOrder(
    amount: number,
    currency: string,
    quoteId: string,
    description?: string,
    returnUrl?: string,
    cancelUrl?: string
  ): Promise<{ id: string; approvalUrl: string }> {
    const token = await getAccessToken();

    const applicationContext: any = {
      brand_name: "Warehouse Tire",
      shipping_preference: "NO_SHIPPING", // We collect shipping ourselves
      user_action: "PAY_NOW",
    };

    if (returnUrl) {
      applicationContext.return_url = returnUrl;
    }
    if (cancelUrl) {
      applicationContext.cancel_url = cancelUrl;
    }

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: quoteId,
            description: description || "Warehouse Tire Order",
            amount: {
              currency_code: currency.toUpperCase(),
              value: amount.toFixed(2),
            },
            custom_id: quoteId,
          },
        ],
        application_context: applicationContext,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal create order failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const approvalLink = data.links?.find((l: any) => l.rel === "approve");

    if (!approvalLink?.href) {
      throw new Error("PayPal order created but no approval URL found");
    }

    return {
      id: data.id,
      approvalUrl: approvalLink.href,
    };
  }

  async function captureOrder(orderId: string): Promise<{ id: string; status: string; payer?: any }> {
    const token = await getAccessToken();

    const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PayPal capture failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      status: data.status,
      payer: data.payer,
    };
  }

  return {
    mode,
    clientId,
    getAccessToken,
    createOrder,
    captureOrder,
  };
}
