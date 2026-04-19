import pg from "pg";
import crypto from "node:crypto";
import { getQuote, type QuoteSnapshot } from "./quotes";

export type OrderStatus = 
  | "received"      // Payment successful, order in queue
  | "processing"    // Order being prepared
  | "shipped"       // Order shipped
  | "delivered"     // Order delivered
  | "cancelled";    // Order cancelled

export type OrderRecord = {
  id: string;
  quoteId: string;
  status: OrderStatus;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  amountPaidCents: number;
  paidAt: Date | null;
  customerEmail: string | null;
  customerPhone: string | null;
  snapshot: QuoteSnapshot;
  createdAt: Date;
  updatedAt: Date;
};

export async function ensureOrdersTable(db: pg.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      amount_paid_cents INTEGER NOT NULL DEFAULT 0,
      paid_at TIMESTAMPTZ,
      customer_email TEXT,
      customer_phone TEXT,
      snapshot_json JSONB NOT NULL,
      email_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS orders_quote_id_idx ON orders (quote_id);
    CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
    CREATE INDEX IF NOT EXISTS orders_stripe_session_id_idx ON orders (stripe_session_id);
    CREATE INDEX IF NOT EXISTS orders_stripe_pi_idx ON orders (stripe_payment_intent_id);
  `);
}

function newOrderId() {
  // Format: WTD-XXXXXX (6 alphanumeric chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 for clarity
  let id = "WTD-";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function createOrder(
  db: pg.Pool,
  {
    quoteId,
    stripeSessionId,
    stripePaymentIntentId,
    amountPaidCents,
    customerEmail,
    customerPhone,
    snapshot,
  }: {
    quoteId: string;
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    amountPaidCents: number;
    customerEmail?: string;
    customerPhone?: string;
    snapshot: QuoteSnapshot;
  }
): Promise<{ id: string }> {
  await ensureOrdersTable(db);

  const id = newOrderId();
  
  await db.query({
    text: `
      INSERT INTO orders (
        id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
        amount_paid_cents, paid_at, customer_email, customer_phone, snapshot_json
      ) VALUES ($1, $2, 'received', $3, $4, $5, NOW(), $6, $7, $8)
    `,
    values: [
      id,
      quoteId,
      stripeSessionId || null,
      stripePaymentIntentId || null,
      amountPaidCents,
      customerEmail || null,
      customerPhone || null,
      JSON.stringify(snapshot),
    ],
  });

  return { id };
}

export async function getOrder(db: pg.Pool, id: string): Promise<OrderRecord | null> {
  await ensureOrdersTable(db);
  
  const { rows } = await db.query({
    text: `
      SELECT id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
             amount_paid_cents, paid_at, customer_email, customer_phone,
             snapshot_json, email_sent_at, created_at, updated_at
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    values: [id],
  });

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    quoteId: r.quote_id,
    status: r.status as OrderStatus,
    stripeSessionId: r.stripe_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    amountPaidCents: r.amount_paid_cents,
    paidAt: r.paid_at,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    snapshot: r.snapshot_json as QuoteSnapshot,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getOrderByStripeSession(db: pg.Pool, sessionId: string): Promise<OrderRecord | null> {
  await ensureOrdersTable(db);
  
  const { rows } = await db.query({
    text: `
      SELECT id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
             amount_paid_cents, paid_at, customer_email, customer_phone,
             snapshot_json, email_sent_at, created_at, updated_at
      FROM orders
      WHERE stripe_session_id = $1
      LIMIT 1
    `,
    values: [sessionId],
  });

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    quoteId: r.quote_id,
    status: r.status as OrderStatus,
    stripeSessionId: r.stripe_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    amountPaidCents: r.amount_paid_cents,
    paidAt: r.paid_at,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    snapshot: r.snapshot_json as QuoteSnapshot,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getOrderByQuote(db: pg.Pool, quoteId: string): Promise<OrderRecord | null> {
  await ensureOrdersTable(db);
  
  const { rows } = await db.query({
    text: `
      SELECT id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
             amount_paid_cents, paid_at, customer_email, customer_phone,
             snapshot_json, email_sent_at, created_at, updated_at
      FROM orders
      WHERE quote_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    values: [quoteId],
  });

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    quoteId: r.quote_id,
    status: r.status as OrderStatus,
    stripeSessionId: r.stripe_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    amountPaidCents: r.amount_paid_cents,
    paidAt: r.paid_at,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    snapshot: r.snapshot_json as QuoteSnapshot,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getOrderByPaymentIntent(db: pg.Pool, paymentIntentId: string): Promise<OrderRecord | null> {
  await ensureOrdersTable(db);
  
  const { rows } = await db.query({
    text: `
      SELECT id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
             amount_paid_cents, paid_at, customer_email, customer_phone,
             snapshot_json, email_sent_at, created_at, updated_at
      FROM orders
      WHERE stripe_payment_intent_id = $1
      LIMIT 1
    `,
    values: [paymentIntentId],
  });

  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    quoteId: r.quote_id,
    status: r.status as OrderStatus,
    stripeSessionId: r.stripe_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    amountPaidCents: r.amount_paid_cents,
    paidAt: r.paid_at,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    snapshot: r.snapshot_json as QuoteSnapshot,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function updateOrderStatus(
  db: pg.Pool,
  orderId: string,
  status: OrderStatus
): Promise<boolean> {
  await ensureOrdersTable(db);
  
  const result = await db.query({
    text: `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1`,
    values: [orderId, status],
  });

  return (result.rowCount || 0) > 0;
}

export async function markOrderEmailSent(db: pg.Pool, orderId: string): Promise<void> {
  await db.query({
    text: `UPDATE orders SET email_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
    values: [orderId],
  });
}

export async function listOrders(
  db: pg.Pool,
  { limit = 50, status }: { limit?: number; status?: OrderStatus } = {}
): Promise<OrderRecord[]> {
  await ensureOrdersTable(db);
  
  let query = `
    SELECT id, quote_id, status, stripe_session_id, stripe_payment_intent_id,
           amount_paid_cents, paid_at, customer_email, customer_phone,
           snapshot_json, email_sent_at, created_at, updated_at
    FROM orders
  `;
  const values: any[] = [];
  
  if (status) {
    query += ` WHERE status = $1`;
    values.push(status);
  }
  
  query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
  values.push(Math.min(limit, 200));

  const { rows } = await db.query({ text: query, values });

  return rows.map((r: any) => ({
    id: r.id,
    quoteId: r.quote_id,
    status: r.status as OrderStatus,
    stripeSessionId: r.stripe_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    amountPaidCents: r.amount_paid_cents,
    paidAt: r.paid_at,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    snapshot: r.snapshot_json as QuoteSnapshot,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
