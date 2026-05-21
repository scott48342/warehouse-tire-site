import Link from "next/link";
import pg from "pg";
import { OrderStatusUpdater } from "./OrderStatusUpdater";
import { ResendEmailButton } from "./ResendEmailButton";
import { ResourceSupplier } from "./ResourceSupplier";

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
  // Customer/shipping address (present for all orders)
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  };
  // Local mode metadata (install orders only)
  localMode?: {
    channel: string;
    fulfillmentMode: string;
    installStore: string;
    installStoreName: string;
    installStorePhone: string;
    installStoreAddress: string;
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

type SupplierOrderRow = {
  id: number;
  supplier: string;
  supplier_order_number: string;
  status: string;
  tracking_numbers: string[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

async function getOrder(id: string): Promise<{ order: OrderRow | null; supplierOrders: SupplierOrderRow[] }> {
  const pool = getPool();
  try {
    await ensureOrdersTable(pool);
    
    const { rows } = await pool.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1`,
      [id]
    );
    
    // Also fetch supplier orders
    const { rows: supplierOrders } = await pool.query<SupplierOrderRow>(`
      SELECT id, supplier, supplier_order_number, status, tracking_numbers, error_message, created_at, updated_at
      FROM supplier_orders
      WHERE order_id = $1
      ORDER BY created_at DESC
    `, [id]);
    
    return { order: rows[0] || null, supplierOrders };
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
  const { order, supplierOrders } = await getOrder(id);

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
  const localMode = snapshot.localMode;
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
              {snapshot.shippingAddress && (
                <div className="col-span-2">
                  <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">
                    {localMode ? "Customer Address" : "Shipping Address"}
                  </div>
                  <div className="text-white">
                    {snapshot.shippingAddress.address1}
                    {snapshot.shippingAddress.address2 && (
                      <>, {snapshot.shippingAddress.address2}</>
                    )}
                    <br />
                    {snapshot.shippingAddress.city}, {snapshot.shippingAddress.state} {snapshot.shippingAddress.zip}
                  </div>
                </div>
              )}
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
                  <LineItem key={i} line={line} orderId={order.id} showResource={true} />
                ))}
              </div>
            </Section>
          )}

          {/* Tires */}
          {tireLines.length > 0 && (
            <Section title="Tires">
              <div className="space-y-3">
                {tireLines.map((line, i) => (
                  <LineItem key={i} line={line} orderId={order.id} showResource={true} />
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

          {/* Supplier Orders & Tracking */}
          {supplierOrders.length > 0 && (
            <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
              <h3 className="text-lg font-bold text-white mb-4">Supplier Orders</h3>
              <div className="space-y-3">
                {supplierOrders.map((so) => (
                  <div key={so.id} className="p-3 bg-neutral-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        so.supplier === 'usautoforce' ? 'bg-green-600' : 
                        so.supplier === 'wheelpros' ? 'bg-red-600' : 'bg-neutral-600'
                      } text-white`}>
                        {so.supplier === 'usautoforce' ? 'US AutoForce' : 
                         so.supplier === 'wheelpros' ? 'WheelPros' : so.supplier}
                      </span>
                      <span className={`text-xs font-medium ${
                        so.status === 'shipped' || so.status === 'delivered' ? 'text-green-400' :
                        so.status === 'error' ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {so.status}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 mb-2">
                      Order #: <code className="bg-neutral-700 px-1 rounded">{so.supplier_order_number}</code>
                    </div>
                    {so.tracking_numbers && so.tracking_numbers.length > 0 && (
                      <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded">
                        <div className="text-xs text-green-400 font-medium mb-1">📦 Tracking</div>
                        {so.tracking_numbers.map((tracking, idx) => (
                          <a
                            key={idx}
                            href={`https://www.fedex.com/fedextrack/?trknbr=${tracking}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-green-300 hover:text-green-200 font-mono"
                          >
                            {tracking} ↗
                          </a>
                        ))}
                      </div>
                    )}
                    {so.error_message && (
                      <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded">
                        <div className="text-xs text-red-400">{so.error_message}</div>
                      </div>
                    )}
                    {so.updated_at && (
                      <div className="text-xs text-neutral-500 mt-2">
                        Updated: {new Date(so.updated_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supplier Summary */}
          {(() => {
            const supplierMap = new Map<string, { items: typeof lines; total: number }>();
            for (const line of lines) {
              const source = line.meta?.source;
              if (source && (line.meta?.cartType === "tire" || line.meta?.cartType === "wheel")) {
                const existing = supplierMap.get(source) || { items: [], total: 0 };
                existing.items.push(line);
                existing.total += (line.unitPriceUsd || 0) * (line.qty || 0);
                supplierMap.set(source, existing);
              }
            }
            
            if (supplierMap.size === 0) return null;
            
            const supplierInfo = (source: string) => {
              const suppliers: Record<string, { name: string; color: string; autoOrder: boolean }> = {
                "tireweb:atd": { name: "ATD", color: "bg-orange-600", autoOrder: false },
                "tireweb:ntw": { name: "NTW", color: "bg-blue-600", autoOrder: false },
                "tireweb:usautoforce": { name: "USAF (TireWeb)", color: "bg-green-600", autoOrder: false },
                "tireweb:km": { name: "K&M", color: "bg-purple-600", autoOrder: false },
                "usautoforce": { name: "US AutoForce", color: "bg-green-500", autoOrder: true },
                "wheelpros": { name: "WheelPros", color: "bg-red-600", autoOrder: true },
              };
              return suppliers[source] || { name: source, color: "bg-neutral-600", autoOrder: false };
            };
            
            return (
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
                <h3 className="text-lg font-bold text-white mb-4">Supplier Summary</h3>
                <div className="space-y-3">
                  {Array.from(supplierMap.entries()).map(([source, data]) => {
                    const info = supplierInfo(source);
                    return (
                      <div key={source} className="p-3 bg-neutral-700/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm px-2 py-1 rounded-full text-white font-medium ${info.color}`}>
                            {info.name}
                          </span>
                          {info.autoOrder ? (
                            <span className="text-xs text-green-400 font-medium">✓ Auto-order</span>
                          ) : (
                            <span className="text-xs text-amber-400 font-medium">⚠ Manual order</span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {data.items.length} item{data.items.length > 1 ? "s" : ""} · {formatMoney(data.total)}
                        </div>
                        <div className="text-xs text-neutral-500 mt-1">
                          {data.items.map(item => item.sku).filter(Boolean).join(", ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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

          {/* Actions */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
            <h3 className="text-lg font-bold text-white mb-4">Actions</h3>
            <ResendEmailButton orderId={order.id} />
          </div>

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

// Format supplier source for display
function formatSupplier(source?: string): { name: string; color: string } | null {
  if (!source) return null;
  
  const suppliers: Record<string, { name: string; color: string }> = {
    "tireweb:atd": { name: "ATD", color: "bg-orange-600" },
    "tireweb:ntw": { name: "NTW", color: "bg-blue-600" },
    "tireweb:usautoforce": { name: "USAF (TireWeb)", color: "bg-green-600" },
    "tireweb:km": { name: "K&M", color: "bg-purple-600" },
    "usautoforce": { name: "US AutoForce", color: "bg-green-500" },
    "wheelpros": { name: "WheelPros", color: "bg-red-600" },
  };
  
  return suppliers[source] || { name: source, color: "bg-neutral-600" };
}

function LineItem({
  line,
  orderId,
  showResource = false,
}: {
  line: {
    name: string;
    sku?: string;
    unitPriceUsd: number;
    qty: number;
    meta?: Record<string, any>;
  };
  orderId?: string;
  showResource?: boolean;
}) {
  const ext = (line.unitPriceUsd || 0) * (line.qty || 0);
  const isIncluded = line.unitPriceUsd === 0 && line.meta?.required;
  const supplier = formatSupplier(line.meta?.source);
  const isManualOrder = line.meta?.source?.startsWith('tireweb');
  const canResource = showResource && orderId && line.sku && (line.meta?.cartType === 'tire' || line.meta?.cartType === 'wheel');

  return (
    <div className="p-3 bg-neutral-700/50 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{line.name}</span>
            {supplier && (
              <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${supplier.color}`}>
                {supplier.name}
              </span>
            )}
            {isManualOrder && (
              <span className="text-xs text-amber-400">⚠ Manual</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {line.sku && (
              <span className="text-xs text-neutral-400">
                SKU: <code className="bg-neutral-700 px-1 rounded">{line.sku}</code>
              </span>
            )}
            {line.meta?.brand && (
              <span className="text-xs text-neutral-400">
                Brand: <span className="text-neutral-300">{line.meta.brand}</span>
              </span>
            )}
            {line.meta?.tireSize && (
              <span className="text-xs text-neutral-400">
                Size: <span className="text-neutral-300">{line.meta.tireSize}</span>
              </span>
            )}
          </div>
          {line.meta?.spec?.threadSize && (
            <div className="text-xs text-neutral-400 mt-0.5">
              Thread: {line.meta.spec.threadSize}
            </div>
          )}
          {line.meta?.resourcedAt && (
            <div className="text-xs text-green-400 mt-1">
              ✓ Re-sourced from {line.meta.originalSource} on {new Date(line.meta.resourcedAt).toLocaleDateString()}
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
      {canResource && (
        <ResourceSupplier 
          orderId={orderId}
          sku={line.sku!}
          currentSource={line.meta?.source || 'unknown'}
          itemName={line.name}
          tireSize={line.meta?.tireSize}
        />
      )}
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
