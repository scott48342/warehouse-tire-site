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

async function getStats() {
  const pool = getPool();
  try {
    const [todayRes, weekRes, totalRes, flaggedRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM quotes WHERE created_at >= CURRENT_DATE`),
      pool.query(`SELECT COUNT(*) as count FROM quotes WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*) as count FROM quotes`),
      pool.query(`SELECT COUNT(*) as count FROM admin_product_flags WHERE flagged = true`),
    ]);

    return {
      ordersToday: parseInt(todayRes.rows[0]?.count || "0", 10),
      ordersWeek: parseInt(weekRes.rows[0]?.count || "0", 10),
      ordersTotal: parseInt(totalRes.rows[0]?.count || "0", 10),
      flaggedProducts: parseInt(flaggedRes.rows[0]?.count || "0", 10),
      recentErrors: 0,
    };
  } catch (err) {
    console.error("[admin] Error fetching stats:", err);
    return {
      ordersToday: 0,
      ordersWeek: 0,
      ordersTotal: 0,
      flaggedProducts: 0,
      recentErrors: 0,
    };
  } finally {
    await pool.end();
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-neutral-400 mt-1">Welcome to the admin portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="📦"
          label="Orders Today"
          value={stats.ordersToday}
          href="/admin/orders?filter=today"
        />
        <StatCard
          icon="📅"
          label="Orders This Week"
          value={stats.ordersWeek}
          href="/admin/orders?filter=week"
        />
        <StatCard
          icon="📊"
          label="Total Orders"
          value={stats.ordersTotal}
          href="/admin/orders"
        />
        <StatCard
          icon="⚠️"
          label="Flagged Products"
          value={stats.flaggedProducts}
          href="/admin/products?filter=flagged"
          alert={stats.flaggedProducts > 0}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            icon="📦"
            label="View Orders"
            description="See all submitted orders and quotes"
            href="/admin/orders"
          />
          <QuickAction
            icon="🔧"
            label="Fitment Overrides"
            description="Edit vehicle fitment data"
            href="/admin/fitment"
          />
          <QuickAction
            icon="📋"
            label="View Logs"
            description="Check fitment resolution logs"
            href="/admin/logs"
          />
        </div>
      </div>

      {/* Recent Activity placeholder */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
        <div className="text-neutral-500 text-sm">
          Activity feed will appear here once orders start coming in.
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  alert,
}: {
  icon: string;
  label: string;
  value: number;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`bg-neutral-800 rounded-xl border p-5 hover:border-neutral-600 transition-colors ${
        alert ? "border-amber-600" : "border-neutral-700"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{icon}</span>
        {alert && <span className="text-amber-500 text-xs font-bold">!</span>}
      </div>
      <div className="mt-3">
        <div className="text-3xl font-bold text-white">{value}</div>
        <div className="text-sm text-neutral-400 mt-1">{label}</div>
      </div>
    </Link>
  );
}

function QuickAction({
  icon,
  label,
  description,
  href,
}: {
  icon: string;
  label: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-neutral-700/50 rounded-xl p-4 hover:bg-neutral-700 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-semibold text-white group-hover:text-red-400 transition-colors">
            {label}
          </div>
          <div className="text-xs text-neutral-400">{description}</div>
        </div>
      </div>
    </Link>
  );
}
