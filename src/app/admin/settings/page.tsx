export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-neutral-400 mt-1">
          Configure payments, suppliers, and site settings
        </p>
      </div>

      {/* Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payments */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">💳</span>
            <h2 className="text-lg font-bold text-white">Payments</h2>
          </div>
          <div className="space-y-4">
            <SettingRow
              label="Stripe"
              description="Payment processing"
              enabled={true}
            />
          </div>
        </div>

        {/* Suppliers */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏭</span>
            <h2 className="text-lg font-bold text-white">Suppliers</h2>
          </div>
          <div className="space-y-4">
            <SettingRow
              label="WheelPros"
              description="Wheels supplier"
              enabled={true}
            />
            <SettingRow
              label="Keystone"
              description="Tires supplier"
              enabled={true}
            />
          </div>
        </div>

        {/* Site */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🌐</span>
            <h2 className="text-lg font-bold text-white">Site</h2>
          </div>
          <div className="space-y-4">
            <SettingRow
              label="Maintenance Mode"
              description="Disable site for updates"
              enabled={false}
            />
          </div>
        </div>

        {/* Future: Multi-tenant */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 opacity-50">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🏢</span>
            <h2 className="text-lg font-bold text-white">Multi-Client</h2>
          </div>
          <div className="text-sm text-neutral-400">
            Multi-tenant configuration coming in a future update
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-amber-200 text-sm">
        <strong>Note:</strong> Settings are currently read-only. Edit functionality coming in the next update.
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  enabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-white font-medium">{label}</div>
        <div className="text-xs text-neutral-400">{description}</div>
      </div>
      <div
        className={`px-2 py-1 rounded text-xs font-medium ${
          enabled
            ? "bg-green-900/50 text-green-400"
            : "bg-neutral-700 text-neutral-400"
        }`}
      >
        {enabled ? "Enabled" : "Disabled"}
      </div>
    </div>
  );
}
