import Link from "next/link";
import pg from "pg";
import { getStats as getCartStats } from "@/lib/cart/abandonedCartService";

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
    // Fetch cart stats in parallel
    const cartStatsPromise = getCartStats().catch(err => {
      console.warn("[admin] Error fetching cart stats:", err);
      return {
        active: 0,
        abandoned: 0,
        recovered: 0,
        expired: 0,
        abandonedValue: 0,
        recoveredValue: 0,
        recentAbandoned: [],
      };
    });

    const [todayRes, weekRes, totalRes, flaggedRes, errorsRes, issuesRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM quotes WHERE created_at >= CURRENT_DATE`),
      pool.query(`SELECT COUNT(*) as count FROM quotes WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*) as count FROM quotes`),
      pool.query(`SELECT COUNT(*) as count FROM admin_product_flags WHERE flagged = true`),
      pool.query(`SELECT COUNT(*) as count FROM admin_logs WHERE log_type = 'search_error' AND created_at >= CURRENT_DATE - INTERVAL '24 hours'`),
      pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN log_type = 'search_error' THEN 1 ELSE 0 END), 0) as search_errors,
          COALESCE(SUM(CASE WHEN log_type = 'warning' THEN 1 ELSE 0 END), 0) as warnings,
          COALESCE(SUM(CASE WHEN log_type = 'fitment' AND details->>'quality' = 'invalid' THEN 1 ELSE 0 END), 0) as fitment_issues
        FROM admin_logs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
      `),
    ]);

    // Fetch Fitment API stats
    let apiStats = { pendingRequests: [], activeKeys: 0, requestsToday: 0, requestsMonth: 0 };
    try {
      const [pendingRes, keysRes, apiUsageRes] = await Promise.all([
        pool.query(`SELECT id, name, email, company, use_case, expected_usage, created_at FROM api_access_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5`),
        pool.query(`SELECT COUNT(*) as count FROM api_keys WHERE active = true`),
        pool.query(`SELECT COALESCE(SUM(monthly_request_count), 0) as month_total FROM api_keys`),
      ]);
      apiStats = {
        pendingRequests: pendingRes.rows,
        activeKeys: parseInt(keysRes.rows[0]?.count || "0", 10),
        requestsToday: 0, // Would need api_usage_logs table
        requestsMonth: parseInt(apiUsageRes.rows[0]?.month_total || "0", 10),
      };
    } catch (apiErr) {
      console.warn("[admin] Error fetching API stats (tables may not exist):", apiErr);
    }

    // Get recent logs for issues panel
    const recentIssuesRes = await pool.query(`
      SELECT log_type, vehicle_params, details, created_at
      FROM admin_logs
      WHERE log_type IN ('search_error', 'warning', 'fitment')
        AND created_at >= CURRENT_DATE - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Get performance metrics from logs
    const perfRes = await pool.query(`
      SELECT 
        AVG((details->>'searchTimeMs')::numeric) as avg_search_time,
        MAX((details->>'searchTimeMs')::numeric) as max_search_time,
        COUNT(*) as total_searches
      FROM admin_logs
      WHERE log_type = 'fitment' 
        AND details->>'searchTimeMs' IS NOT NULL
        AND created_at >= CURRENT_DATE - INTERVAL '24 hours'
    `);

    // Wait for cart stats
    const cartStats = await cartStatsPromise;

    return {
      ordersToday: parseInt(todayRes.rows[0]?.count || "0", 10),
      ordersWeek: parseInt(weekRes.rows[0]?.count || "0", 10),
      ordersTotal: parseInt(totalRes.rows[0]?.count || "0", 10),
      flaggedProducts: parseInt(flaggedRes.rows[0]?.count || "0", 10),
      recentErrors: parseInt(errorsRes.rows[0]?.count || "0", 10),
      issues: {
        searchErrors: parseInt(issuesRes.rows[0]?.search_errors || "0", 10),
        warnings: parseInt(issuesRes.rows[0]?.warnings || "0", 10),
        fitmentIssues: parseInt(issuesRes.rows[0]?.fitment_issues || "0", 10),
      },
      recentIssues: recentIssuesRes.rows,
      performance: {
        avgSearchTime: Math.round(parseFloat(perfRes.rows[0]?.avg_search_time || "0")),
        maxSearchTime: Math.round(parseFloat(perfRes.rows[0]?.max_search_time || "0")),
        totalSearches: parseInt(perfRes.rows[0]?.total_searches || "0", 10),
      },
      carts: cartStats,
      api: apiStats,
    };
  } catch (err) {
    console.error("[admin] Error fetching stats:", err);
    return {
      ordersToday: 0,
      ordersWeek: 0,
      ordersTotal: 0,
      flaggedProducts: 0,
      recentErrors: 0,
      issues: { searchErrors: 0, warnings: 0, fitmentIssues: 0 },
      recentIssues: [],
      performance: { avgSearchTime: 0, maxSearchTime: 0, totalSearches: 0 },
      carts: { active: 0, abandoned: 0, recovered: 0, expired: 0, abandonedValue: 0, recoveredValue: 0, recentAbandoned: [] },
      api: { pendingRequests: [], activeKeys: 0, requestsToday: 0, requestsMonth: 0 },
    };
  } finally {
    await pool.end();
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();
  const totalIssues = stats.issues.searchErrors + stats.issues.warnings + stats.issues.fitmentIssues;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-neutral-400 mt-1">Welcome to the admin portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
        <StatCard
          icon="🚨"
          label="Issues (24h)"
          value={totalIssues}
          href="/admin/logs"
          alert={totalIssues > 0}
        />
      </div>

      {/* Performance & Issues Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Metrics */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>📈</span> Performance (24h)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <MetricCard
              label="Avg Search"
              value={stats.performance.avgSearchTime > 0 ? `${stats.performance.avgSearchTime}ms` : "—"}
              status={stats.performance.avgSearchTime < 1000 ? "good" : stats.performance.avgSearchTime < 3000 ? "warn" : "bad"}
            />
            <MetricCard
              label="Max Search"
              value={stats.performance.maxSearchTime > 0 ? `${stats.performance.maxSearchTime}ms` : "—"}
              status={stats.performance.maxSearchTime < 3000 ? "good" : stats.performance.maxSearchTime < 5000 ? "warn" : "bad"}
            />
            <MetricCard
              label="Total Searches"
              value={stats.performance.totalSearches.toString()}
              status="neutral"
            />
          </div>
        </div>

        {/* Issues Panel - Grouped by Severity */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>🚨</span> Issues (24h)
            {totalIssues > 0 && (
              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full ml-2">
                {totalIssues}
              </span>
            )}
          </h2>
          {totalIssues === 0 ? (
            <div className="text-neutral-500 text-sm py-4 text-center">
              ✅ No issues in the last 24 hours
            </div>
          ) : (
            <div className="space-y-4">
              {/* Critical - Search Errors */}
              {stats.issues.searchErrors > 0 && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                  <div className="text-xs text-red-400 font-medium mb-2">🔴 CRITICAL</div>
                  <IssueRow
                    icon="❌"
                    label="Search Errors"
                    count={stats.issues.searchErrors}
                    href="/admin/logs?type=search_error"
                    description="Searches that failed - customers may not see results"
                  />
                </div>
              )}
              
              {/* Warning - Fitment Issues */}
              {stats.issues.fitmentIssues > 0 && (
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3">
                  <div className="text-xs text-amber-400 font-medium mb-2">🟡 WARNING</div>
                  <IssueRow
                    icon="🔧"
                    label="Fitment Issues"
                    count={stats.issues.fitmentIssues}
                    href="/admin/fitment"
                    description="Vehicles with incomplete or invalid fitment data"
                  />
                </div>
              )}
              
              {/* Info - Warnings */}
              {stats.issues.warnings > 0 && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                  <div className="text-xs text-blue-400 font-medium mb-2">🔵 INFO</div>
                  <IssueRow
                    icon="⚠️"
                    label="Warnings"
                    count={stats.issues.warnings}
                    href="/admin/logs?type=warning"
                    description="Non-critical issues logged for review"
                  />
                </div>
              )}

              {/* Flagged Products - links to Products tab */}
              {stats.flaggedProducts > 0 && (
                <div className="bg-neutral-700/30 border border-neutral-600/50 rounded-lg p-3">
                  <div className="text-xs text-neutral-400 font-medium mb-2">📋 ATTENTION</div>
                  <IssueRow
                    icon="🚩"
                    label="Flagged Products"
                    count={stats.flaggedProducts}
                    href="/admin/products?filter=flagged"
                    description="Products marked for review"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Abandoned Carts Section */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🛒</span> Cart Tracking
          </h2>
          <Link href="/admin/abandoned-carts" className="text-sm text-red-400 hover:text-red-300">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CartMetricCard
            label="Active Carts"
            value={stats.carts.active}
            color="green"
          />
          <CartMetricCard
            label="Abandoned"
            value={stats.carts.abandoned}
            subValue={stats.carts.abandonedValue > 0 ? formatCurrency(stats.carts.abandonedValue) : undefined}
            color="yellow"
            alert={stats.carts.abandoned > 0}
          />
          <CartMetricCard
            label="Recovered"
            value={stats.carts.recovered}
            subValue={stats.carts.recoveredValue > 0 ? formatCurrency(stats.carts.recoveredValue) : undefined}
            color="blue"
          />
          <CartMetricCard
            label="Recovery Rate"
            value={stats.carts.abandoned + stats.carts.recovered > 0 
              ? `${Math.round((stats.carts.recovered / (stats.carts.abandoned + stats.carts.recovered)) * 100)}%`
              : "—"}
            color="neutral"
          />
        </div>
        {stats.carts.recentAbandoned && stats.carts.recentAbandoned.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="text-xs text-neutral-400 mb-2">Recent Abandoned Carts</div>
            <div className="space-y-1">
              {stats.carts.recentAbandoned.slice(0, 3).map((cart: any) => (
                <div key={cart.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">⚠️</span>
                    <span className="text-neutral-300">
                      {cart.customerEmail || `Cart ${cart.cartId.slice(0, 8)}...`}
                    </span>
                    {cart.vehicleYear && (
                      <span className="text-neutral-500 text-xs">
                        ({cart.vehicleYear} {cart.vehicleMake} {cart.vehicleModel})
                      </span>
                    )}
                  </div>
                  <span className="text-neutral-400 font-medium">
                    {formatCurrency(Number(cart.estimatedTotal))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fitment API Section */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔑</span> Fitment API
            {stats.api.pendingRequests.length > 0 && (
              <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full ml-2">
                {stats.api.pendingRequests.length} pending
              </span>
            )}
          </h2>
          <Link href="/admin/fitment-api" className="text-sm text-blue-400 hover:text-blue-300">
            Manage API →
          </Link>
        </div>
        
        {/* API Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.api.activeKeys}</div>
            <div className="text-xs text-neutral-400">Active Keys</div>
          </div>
          <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.api.requestsMonth.toLocaleString()}</div>
            <div className="text-xs text-neutral-400">Requests (Month)</div>
          </div>
          <div className="bg-neutral-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.api.pendingRequests.length}</div>
            <div className="text-xs text-neutral-400">Pending Requests</div>
          </div>
        </div>

        {/* Pending Requests */}
        {stats.api.pendingRequests.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs text-neutral-400 mb-2">Pending Access Requests</div>
            {stats.api.pendingRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between bg-neutral-700/30 rounded-lg p-3">
                <div className="flex-1">
                  <div className="text-white font-medium">{req.name}</div>
                  <div className="text-xs text-neutral-400">{req.company} • {req.use_case}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/admin/fitment-api?request=${req.id}`}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-neutral-500 text-sm text-center py-4">
            ✅ No pending access requests
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <QuickAction
            icon="📦"
            label="View Orders"
            description="See all submitted orders"
            href="/admin/orders"
          />
          <QuickAction
            icon="🔑"
            label="Fitment API"
            description="Manage API access & keys"
            href="/admin/fitment-api"
          />
          <QuickAction
            icon="🔧"
            label="Fitment Data"
            description="Edit vehicle fitment"
            href="/admin/fitment"
          />
          <QuickAction
            icon="🛞"
            label="Products"
            description="Flag or hide products"
            href="/admin/products"
          />
        </div>
      </div>

      {/* Recent Issues List */}
      {stats.recentIssues.length > 0 && (
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Recent Issues</h2>
            <Link href="/admin/logs" className="text-sm text-red-400 hover:text-red-300">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {stats.recentIssues.slice(0, 5).map((issue: any, i: number) => (
              <RecentIssueItem key={i} issue={issue} />
            ))}
          </div>
        </div>
      )}
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

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "good" | "warn" | "bad" | "neutral";
}) {
  const statusColors = {
    good: "text-green-400",
    warn: "text-amber-400",
    bad: "text-red-400",
    neutral: "text-white",
  };

  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${statusColors[status]}`}>{value}</div>
      <div className="text-xs text-neutral-500 mt-1">{label}</div>
    </div>
  );
}

function IssueRow({
  icon,
  label,
  count,
  href,
  description,
}: {
  icon: string;
  label: string;
  count: number;
  href: string;
  description?: string;
}) {
  if (count === 0) return null;
  
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-700/50 transition-colors group"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm text-neutral-300 group-hover:text-white">{label}</span>
        </div>
        {description && (
          <div className="text-xs text-neutral-500 ml-6 mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">{count}</span>
        <span className="text-xs text-neutral-500 group-hover:text-neutral-300">→</span>
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

function RecentIssueItem({ issue }: { issue: any }) {
  const icons: Record<string, string> = {
    search_error: "❌",
    warning: "⚠️",
    fitment: "🔧",
  };

  const vehicle = issue.vehicle_params
    ? `${issue.vehicle_params.year || ""} ${issue.vehicle_params.make || ""} ${issue.vehicle_params.model || ""}`.trim()
    : null;

  const message = issue.details?.error || issue.details?.message || issue.log_type;
  const time = new Date(issue.created_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-neutral-700/30">
      <span className="text-lg">{icons[issue.log_type] || "📋"}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{message}</div>
        {vehicle && (
          <div className="text-xs text-neutral-500">{vehicle}</div>
        )}
      </div>
      <div className="text-xs text-neutral-500">{time}</div>
    </div>
  );
}

function CartMetricCard({
  label,
  value,
  subValue,
  color = "neutral",
  alert,
}: {
  label: string;
  value: number | string;
  subValue?: string;
  color?: "green" | "yellow" | "blue" | "neutral";
  alert?: boolean;
}) {
  const colorClasses = {
    green: "border-green-700/50 bg-green-900/20",
    yellow: "border-yellow-700/50 bg-yellow-900/20",
    blue: "border-blue-700/50 bg-blue-900/20",
    neutral: "border-neutral-700 bg-neutral-700/30",
  };

  const valueColors = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
    neutral: "text-white",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="text-xs text-neutral-400">{label}</div>
        {alert && <span className="text-yellow-500 text-xs">●</span>}
      </div>
      <div className={`text-2xl font-bold mt-1 ${valueColors[color]}`}>{value}</div>
      {subValue && <div className="text-xs text-neutral-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
