import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Logs & Diagnostics</h1>
        <p className="text-neutral-400 mt-1">
          View system logs and debug information
        </p>
      </div>

      {/* Log Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/logs/fitment"
          className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 hover:border-neutral-600 transition-colors"
        >
          <div className="text-2xl mb-2">🔧</div>
          <div className="text-lg font-bold text-white">Fitment Logs</div>
          <div className="text-sm text-neutral-400 mt-1">
            Resolution paths and sources
          </div>
        </Link>

        <Link
          href="/admin/logs/inventory"
          className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 hover:border-neutral-600 transition-colors"
        >
          <div className="text-2xl mb-2">📦</div>
          <div className="text-lg font-bold text-white">Inventory Logs</div>
          <div className="text-sm text-neutral-400 mt-1">
            Filter decisions and availability
          </div>
        </Link>

        <Link
          href="/admin/logs/errors"
          className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 hover:border-neutral-600 transition-colors"
        >
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-lg font-bold text-white">Errors</div>
          <div className="text-sm text-neutral-400 mt-1">
            Failed searches and warnings
          </div>
        </Link>
      </div>

      {/* Coming Soon */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-8 text-center">
        <div className="text-4xl mb-4">📋</div>
        <div className="text-lg font-medium text-white">Coming Soon</div>
        <div className="text-sm text-neutral-400 mt-1">
          Log viewer will be available in the next update.
          <br />
          Logs are already being collected in the admin_logs table.
        </div>
      </div>
    </div>
  );
}
