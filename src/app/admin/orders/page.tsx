import Link from "next/link";
import pg from "pg";

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

type OrderRow = {
  id: string;
  customer_first: string;
  customer_last: string;
  customer_email: string | null;
  customer_phone: string | null;
  vehicle_label: string | null;
  snapshot_json: any;
  created_at: string;
  updated_at: string;
};

async function getOrders(filter?: string): Promise<OrderRow[]> {
  const pool = getPool();
  try {
    let whereClause = "";
    const values: any[] = [];

    if (filter === "today") {
      whereClause = "WHERE created_at >= CURRENT_DATE";
    } else if (filter === "week") {
      whereClause = "WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'";
    }

    const { rows } = await pool.query<OrderRow>(`
      SELECT 
        id,
        customer_first,
        customer_last,
        customer_email,
        customer_phone,
        vehicle_label,
        snapshot_json,
        created_at,
        updated_at
      FROM quotes
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 100
    `);

    return rows;
  } finally {
    await pool.end();
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(n: number) {
  return `$${(n || 0).toFixed(2)}`;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter;
  
  let orders: OrderRow[] = [];
  let error: string | null = null;

  try {
    orders = await getOrders(filter);
  } catch (err: any) {
    error = err.message;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-neutral-400 mt-1">
            {filter === "today"
              ? "Orders submitted today"
              : filter === "week"
              ? "Orders from the past week"
              : "All submitted orders and quotes"}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <FilterButton href="/admin/orders" label="All" active={!filter} />
          <FilterButton
            href="/admin/orders?filter=today"
            label="Today"
            active={filter === "today"}
          />
          <FilterButton
            href="/admin/orders?filter=week"
            label="This Week"
            active={filter === "week"}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          Error loading orders: {error}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No orders found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-700 text-left text-sm text-neutral-400">
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {orders.map((order) => {
                const snapshot = order.snapshot_json || {};
                const total = snapshot.totals?.total || 0;

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-neutral-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <code className="text-sm text-neutral-300 bg-neutral-700 px-2 py-0.5 rounded">
                        {order.id.slice(0, 8).toUpperCase()}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">
                        {order.customer_first} {order.customer_last}
                      </div>
                      {order.customer_email && (
                        <div className="text-xs text-neutral-400">
                          {order.customer_email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-300 text-sm">
                      {order.vehicle_label || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-semibold">
                        {formatMoney(total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-sm">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-sm text-red-400 hover:text-red-300 font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Stats */}
      <div className="text-sm text-neutral-500">
        Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

function FilterButton({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-red-600 text-white"
          : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
      }`}
    >
      {label}
    </Link>
  );
}
