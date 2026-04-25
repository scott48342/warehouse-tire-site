import Link from "next/link";
import pg from "pg";
import { OrderStatusUpdater } from "./OrderStatusUpdater";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

type QuoteSnapshot = {
  customer: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
    modification?: string;
  };
  lines: Array<{
    kind: "product" | "catalog" | "custom";
    name: string;
    sku?: string;
    unitPriceUsd: number;
    qty: number;
    taxable: boolean;
    meta?: Record<string, any>;
  }>;
  taxRate: number;
  totals: {
    partsSubtotal: number;
    servicesSubtotal: number;
    tax: number;
    total: number;
  };
};

type OrderRow = {
  id: string;
  quote_id: string;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_paid_cents: number;
  paid_at: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  snapshot_json: QuoteSnapshot;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

async function ensureOrdersTable(pool: pg.Pool) {
  await pool.query(`
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
  `);
}

async function getOrder(id: string): Promise<OrderRow | null> {
  const pool = getPool();
  try {
    await ensureOrdersTable(pool);
    
    const { rows } = await pool.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  } finally {
    await pool.end();
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(n: number) {
  return `$${(n || 0).toFixed(2)}`;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; description: string }> = {
  received: { color: "bg-green-500", label: "Received", description: "Order received, awaiting processing" },
  processing: { color: "bg-blue-500", label: "Processing", description: "Order is being prepared" },
  parts_ordered: { color: "bg-yellow-500", label: "Parts Ordered", description: "Parts ordered from supplier" },
  ready_for_install: { color: "bg-purple-500", label: "Ready for Install", description: "Parts received, ready for installation" },
  shipped: { color: "bg-indigo-500", label: "Shipped", description: "Order has been shipped" },
  delivered: { color: "bg-neutral-500", label: "Delivered", description: "Order delivered" },
  completed: { color: "bg-emerald-500", label: "Completed", description: "Order completed" },
  cancelled: { color: "bg-red-500", label: "Cancelled", description: "Order was cancelled" },
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <div className="space-y-6">
        <Link
          href="/admin/orders"
          className="text-sm text-neutral-400 hover:text-white"
        >
          ← Back to Orders
        </Link>
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-8 text-center">
          <div className="text-red-300 text-lg font-medium">Order not found</div>
          <div className="text-red-400 text-sm mt-1">ID: {id}</div>
        </div>
      </div>
    );
  }

  const snapshot = order.snapshot_json;
  const customer = snapshot.customer;
  const vehicle = snapshot.vehicle;
  const localMode = (snapshot as any).localMode;
  const lines = snapshot.lines || [];
  const totals = snapshot.totals;
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.received;

  // Categorize lines
  const wheelLines = lines.filter(
    (l) => l.meta?.cartType === "wheel" || l.meta?.productType === "wheel"
  );
  const tireLines = lines.filter(
    (l) => l.meta?.cartType === "tire" || l.meta?.productType === "tire"
  );
  const accessoryLines = lines.filter(
    (l) => l.meta?.cartType === "accessory"
  );
  const serviceLines = lines.filter((l) => l.kind === "catalog");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-sm text-neutral-400 hover:text-white mb-2 inline-block"
          >
            ← Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{order.id}</h1>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color} text-white`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-neutral-400 mt-1">{formatDate(order.created_at)}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/quote/${order.quote_id}`}
            target="_blank"
            className="px-4 py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600"
          >
            View Quote ↗
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Section title="Customer Information">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Name" value={`${customer.firstName} ${customer.lastName}`} />
              <InfoRow label="Email" value={order.customer_email || customer.email || "—"} />
              <InfoRow label="Phone" value={order.customer_phone || customer.phone || "—"} />
            </div>
          </Section>

          {/* Vehicle */}
          <Section title="Vehicle">
            {vehicle ? (
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Year" value={vehicle.year || "—"} />
                <InfoRow label="Make" value={vehicle.make || "—"} />
                <InfoRow label="Model" value={vehicle.model || "—"} />
                <InfoRow label="Trim" value={vehicle.trim || "—"} />
                {vehicle.modification && (
                  <InfoRow
                    label="Modification ID"
                    value={
                      <code className="text-xs bg-neutral-700 px-1.5 py-0.5 rounded">
                        {vehicle.modification}
                      </code>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="text-neutral-500">No vehicle specified</div>
            )}
          </Section>

          {/* Local Installation Order - Prominent Display */}
          {localMode && (
            <div className="bg-blue-900/30 border-2 border-blue-500 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔧</span>
                <div>
                  <h3 className="text-lg font-bold text-blue-300">Installation Order</h3>
                  <p className="text-sm text-blue-400">This order requires in-store installation</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-start gap-3 bg-blue-900/40 rounded-lg p-3">
                  <span className="text-blue-400 font-semibold min-w-[100px]">Install Store:</span>
                  <span className="text-white font-bold text-base">{localMode.installStoreName}</span>
                </div>
                <div className="flex items-start gap-3 bg-blue-900/40 rounded-lg p-3">
                  <span className="text-blue-400 font-semibold min-w-[100px]">Address:</span>
                  <span className="text-white">{localMode.installStoreAddress}</span>
                </div>
                <div className="flex items-start gap-3 bg-blue-900/40 rounded-lg p-3">
                  <span className="text-blue-400 font-semibold min-w-[100px]">Phone:</span>
                  <a href={`tel:${localMode.installStorePhone?.replace(/-/g, '')}`} className="text-blue-300 hover:text-blue-200 font-medium">
                    {localMode.installStorePhone}
                  </a>
                </div>
                <div className="flex items-start gap-3 bg-blue-900/40 rounded-lg p-3">
                  <span className="text-blue-400 font-semibold min-w-[100px]">Channel:</span>
                  <code className="text-xs bg-blue-800 px-2 py-1 rounded text-blue-200">{localMode.channel}</code>
                  <span className="text-neutral-400 mx-1">|</span>
                  <span className="text-blue-400 font-semibold">Fulfillment:</span>
                  <code className="text-xs bg-blue-800 px-2 py-1 rounded text-blue-200">{localMode.fulfillmentMode}</code>
                </div>
              </div>
            </div>
          )}

          {/* Wheels */}
          {wheelLines.length > 0 && (
            <Section title="Wheels">
              <div className="space-y-3">
                {wheelLines.map((line, i) => (
                  <LineItem key={i} line={line} />
                ))}
              </div>
            </Section>
          )}

          {/* Tires */}
          {tireLines.length > 0 && (
            <Section title="Tires">
              <div className="space-y-3">
                {tireLines.map((line, i) => (
                  <LineItem key={i} line={line} />
                ))}
              </div>
            </Section>
          )}

          {/* Accessories */}
          {accessoryLines.length > 0 && (
            <Section title="Accessories">
              <div className="space-y-3">
                {accessoryLines.map((line, i) => (
                  <LineItem key={i} line={line} />
                ))}
              </div>
            </Section>
          )}

          {/* Services */}
          {serviceLines.length > 0 && (
            <Section title="Services">
              <div className="space-y-3">
                {serviceLines.map((line, i) => (
                  <LineItem key={i} line={line} />
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
            <h3 className="text-lg font-bold text-white mb-4">Payment Summary</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Parts Subtotal</span>
                <span className="text-white font-medium">
                  {formatMoney(totals.partsSubtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Services</span>
                <span className="text-white font-medium">
                  {formatMoney(totals.servicesSubtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">
                  Tax ({Math.round((snapshot.taxRate || 0) * 100)}%)
                </span>
                <span className="text-white font-medium">
                  {formatMoney(totals.tax)}
                </span>
              </div>

              <div className="border-t border-neutral-700 pt-3 flex justify-between">
                <span className="text-white font-bold">Order Total</span>
                <span className="text-white font-bold text-lg">
                  {formatMoney(totals.total)}
                </span>
              </div>

              {order.amount_paid_cents > 0 && (
                <div className="flex justify-between text-green-400">
                  <span className="font-medium">Amount Paid</span>
                  <span className="font-bold">
                    {formatCents(order.amount_paid_cents)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Order Status */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
            <h3 className="text-lg font-bold text-white mb-4">Order Status</h3>

            <div className="space-y-3 mb-4">
              <StatusRow
                label="Order Placed"
                status="complete"
                date={order.created_at}
              />
              <StatusRow
                label="Payment"
                status={order.paid_at ? "complete" : "pending"}
                date={order.paid_at || undefined}
                note={order.paid_at ? formatCents(order.amount_paid_cents) : "Awaiting payment"}
              />
              {order.email_sent_at && (
                <StatusRow
                  label="Confirmation Email"
                  status="complete"
                  date={order.email_sent_at}
                />
              )}
            </div>

            {/* Status Updater */}
            <div className="border-t border-neutral-700 pt-4">
              <OrderStatusUpdater orderId={order.id} currentStatus={order.status} />
            </div>
          </div>

          {/* Payment Details */}
          {(order.stripe_session_id || order.stripe_payment_intent_id) && (
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
              <h3 className="text-lg font-bold text-white mb-4">Payment Details</h3>
              
              <div className="space-y-2 text-sm">
                {order.stripe_payment_intent_id && (
                  <div>
                    <div className="text-neutral-500 text-xs">Payment Intent</div>
                    <code className="text-neutral-300 text-xs">{order.stripe_payment_intent_id}</code>
                  </div>
                )}
                {order.stripe_session_id && (
                  <div>
                    <div className="text-neutral-500 text-xs">Session ID</div>
                    <code className="text-neutral-300 text-xs break-all">{order.stripe_session_id}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw Data */}
          <details className="bg-neutral-800 rounded-xl border border-neutral-700">
            <summary className="px-5 py-3 text-sm text-neutral-400 cursor-pointer hover:text-white">
              View Raw JSON
            </summary>
            <pre className="px-5 pb-5 text-xs text-neutral-500 overflow-auto max-h-64">
              {JSON.stringify(snapshot, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-white">{value}</div>
    </div>
  );
}

function LineItem({
  line,
}: {
  line: {
    name: string;
    sku?: string;
    unitPriceUsd: number;
    qty: number;
    meta?: Record<string, any>;
  };
}) {
  const ext = (line.unitPriceUsd || 0) * (line.qty || 0);
  const isIncluded = line.unitPriceUsd === 0 && line.meta?.required;

  return (
    <div className="flex items-start justify-between gap-4 p-3 bg-neutral-700/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium">{line.name}</div>
        {line.sku && (
          <div className="text-xs text-neutral-400 mt-0.5">
            SKU: <code className="bg-neutral-700 px-1 rounded">{line.sku}</code>
          </div>
        )}
        {line.meta?.spec?.threadSize && (
          <div className="text-xs text-neutral-400 mt-0.5">
            Thread: {line.meta.spec.threadSize}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-white font-medium">
          {isIncluded ? (
            <span className="text-green-400">Included</span>
          ) : (
            formatMoney(ext)
          )}
        </div>
        <div className="text-xs text-neutral-400">
          {line.qty}× {formatMoney(line.unitPriceUsd)}
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  status,
  date,
  note,
}: {
  label: string;
  status: "complete" | "pending" | "failed";
  date?: string;
  note?: string;
}) {
  const statusColors = {
    complete: "bg-green-500",
    pending: "bg-amber-500",
    failed: "bg-red-500",
  };

  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-2 h-2 rounded-full mt-1.5 ${statusColors[status]}`}
      />
      <div className="flex-1">
        <div className="text-white text-sm font-medium">{label}</div>
        {date && (
          <div className="text-xs text-neutral-400">
            {new Date(date).toLocaleDateString()}
          </div>
        )}
        {note && <div className="text-xs text-neutral-500">{note}</div>}
      </div>
    </div>
  );
}
