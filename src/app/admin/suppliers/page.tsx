"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ============ Types ============

type Supplier = {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
  credentialsConfigured: boolean;
  credentialSource: "db" | "env" | "none";
  customer_number: string | null;
  company_code: string | null;
  warehouse_codes: string[] | null;
  last_test_at: string | null;
  last_test_status: "success" | "error" | null;
  last_test_message: string | null;
  updated_at: string;
};

type TirewebConnection = {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  connection_id: number | null;
  last_test_at: string | null;
  last_test_status: "success" | "error" | null;
  last_test_message: string | null;
};

type TirewebConfig = {
  access_key: string | null;
  group_token: string | null;
  configured: boolean;
};

// ============ Constants ============

const TIREWEB_SUPPLIERS = [
  { provider: "tireweb_atd", name: "ATD", icon: "🚚", description: "American Tire Distributors" },
  { provider: "tireweb_ntw", name: "NTW", icon: "�icing", description: "National Tire Wholesale" },
  { provider: "tireweb_usautoforce", name: "US AutoForce", icon: "⚡", description: "US AutoForce Distribution" },
];

// ============ Main Page ============

export default function SuppliersPage() {
  // Wheel suppliers state
  const [wheelSuppliers, setWheelSuppliers] = useState<Supplier[]>([]);
  const [savingWheel, setSavingWheel] = useState<string | null>(null);
  const [testingWheel, setTestingWheel] = useState<string | null>(null);

  // TireWeb state
  const [tirewebConnections, setTirewebConnections] = useState<TirewebConnection[]>([]);
  const [tirewebConfig, setTirewebConfig] = useState<TirewebConfig>({ access_key: null, group_token: null, configured: false });
  const [savingTireweb, setSavingTireweb] = useState<string | null>(null);
  const [testingTireweb, setTestingTireweb] = useState<string | null>(null);
  const [editingTirewebCreds, setEditingTirewebCreds] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [groupToken, setGroupToken] = useState("");

  const [loading, setLoading] = useState(true);

  // ============ Data Fetching ============

  const fetchWheelSuppliers = async () => {
    try {
      const res = await fetch("/api/admin/settings/suppliers");
      const data = await res.json();
      setWheelSuppliers(data.suppliers || []);
    } catch (err) {
      console.error("Failed to fetch wheel suppliers:", err);
    }
  };

  const fetchTirewebData = async () => {
    try {
      const res = await fetch("/api/admin/suppliers/tireweb");
      const data = await res.json();
      setTirewebConnections(data.connections || []);
      setTirewebConfig(data.config || { access_key: null, group_token: null, configured: false });
    } catch (err) {
      console.error("Failed to fetch TireWeb config:", err);
    }
  };

  useEffect(() => {
    Promise.all([fetchWheelSuppliers(), fetchTirewebData()]).finally(() => setLoading(false));
  }, []);

  // ============ Wheel Supplier Actions ============

  const updateWheelSupplier = async (supplier: Supplier, updates: Partial<Supplier>) => {
    setSavingWheel(supplier.id);
    try {
      const res = await fetch("/api/admin/settings/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: supplier.id, provider: supplier.provider, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchWheelSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingWheel(null);
    }
  };

  const testWheelSupplier = async (supplier: Supplier) => {
    setTestingWheel(supplier.id);
    try {
      await fetch("/api/admin/settings/suppliers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: supplier.provider }),
      });
      await fetchWheelSuppliers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTestingWheel(null);
    }
  };

  const saveWheelCredentials = async (provider: string, credentials: Record<string, string>) => {
    try {
      const res = await fetch("/api/admin/settings/suppliers/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...credentials }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credentials");
      }
      await fetchWheelSuppliers();
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  // ============ TireWeb Actions ============

  const saveTirewebCredentials = async () => {
    setSavingTireweb("credentials");
    try {
      const res = await fetch("/api/admin/suppliers/tireweb/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey, groupToken }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditingTirewebCreds(false);
      setAccessKey("");
      setGroupToken("");
      await fetchTirewebData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingTireweb(null);
    }
  };

  const toggleTirewebConnection = async (provider: string, enabled: boolean) => {
    setSavingTireweb(provider);
    try {
      const res = await fetch("/api/admin/suppliers/tireweb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchTirewebData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingTireweb(null);
    }
  };

  const updateTirewebConnectionId = async (provider: string, connectionId: number) => {
    setSavingTireweb(provider);
    try {
      const res = await fetch("/api/admin/suppliers/tireweb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, connection_id: connectionId }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchTirewebData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingTireweb(null);
    }
  };

  const testTirewebConnection = async (provider: string) => {
    setTestingTireweb(provider);
    try {
      await fetch("/api/admin/suppliers/tireweb/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      await fetchTirewebData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTestingTireweb(null);
    }
  };

  // ============ Render ============

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Suppliers</h1>
          <p className="text-neutral-400 mt-1">
            Manage wheel and tire supplier connections
          </p>
        </div>
        <Link
          href="/admin/suppliers/status"
          className="px-4 py-2 bg-neutral-700 text-white rounded-lg text-sm font-medium hover:bg-neutral-600 flex items-center gap-2"
        >
          <span>📊</span>
          <span>View Status Dashboard</span>
        </Link>
      </div>

      {/* Connection Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* WheelPros Status */}
        {wheelSuppliers.filter(s => s.provider === "wheelpros").map(s => (
          <div key={s.id} className={`bg-neutral-800 rounded-xl border p-4 ${s.enabled && s.credentialsConfigured ? "border-green-600/50" : "border-neutral-700"}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🛞</span>
              <span className="font-bold text-white">WheelPros</span>
            </div>
            <div className={`text-sm ${s.enabled && s.credentialsConfigured ? "text-green-400" : s.credentialsConfigured ? "text-amber-400" : "text-red-400"}`}>
              {s.enabled && s.credentialsConfigured ? "● Connected" : s.credentialsConfigured ? "● Disabled" : "○ Not configured"}
            </div>
            {s.last_test_at && (
              <div className="text-xs text-neutral-500 mt-1">
                Last sync: {new Date(s.last_test_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
        
        {/* K&M Tire Status */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🚗</span>
            <span className="font-bold text-white">K&M Tire</span>
          </div>
          <div className="text-sm text-green-400">● Connected (ENV)</div>
          <div className="text-xs text-neutral-500 mt-1">Via TireConnect API</div>
        </div>

        {/* TireWeb/ATD Status */}
        {(() => {
          const atd = tirewebConnections.find(c => c.provider === "tireweb_atd");
          const isConnected = atd?.enabled && atd?.connection_id && tirewebConfig.configured;
          return (
            <div className={`bg-neutral-800 rounded-xl border p-4 ${isConnected ? "border-green-600/50" : "border-neutral-700"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🚚</span>
                <span className="font-bold text-white">ATD</span>
              </div>
              <div className={`text-sm ${isConnected ? "text-green-400" : tirewebConfig.configured ? "text-amber-400" : "text-red-400"}`}>
                {isConnected ? "● Connected" : tirewebConfig.configured ? "● Not enabled" : "○ Not configured"}
              </div>
              {atd?.last_test_at && (
                <div className="text-xs text-neutral-500 mt-1">
                  Last sync: {new Date(atd.last_test_at).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })()}

        {/* TireWeb/NTW Status */}
        {(() => {
          const ntw = tirewebConnections.find(c => c.provider === "tireweb_ntw");
          const isConnected = ntw?.enabled && ntw?.connection_id && tirewebConfig.configured;
          return (
            <div className={`bg-neutral-800 rounded-xl border p-4 ${isConnected ? "border-green-600/50" : "border-neutral-700"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📦</span>
                <span className="font-bold text-white">NTW</span>
              </div>
              <div className={`text-sm ${isConnected ? "text-green-400" : tirewebConfig.configured ? "text-amber-400" : "text-red-400"}`}>
                {isConnected ? "● Connected" : tirewebConfig.configured ? "● Not enabled" : "○ Not configured"}
              </div>
              {ntw?.last_test_at && (
                <div className="text-xs text-neutral-500 mt-1">
                  Last sync: {new Date(ntw.last_test_at).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ============ WHEEL SUPPLIERS ============ */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🛞</span> Wheel Suppliers
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {wheelSuppliers.map((supplier) => (
            <WheelSupplierCard
              key={supplier.id}
              supplier={supplier}
              saving={savingWheel === supplier.id}
              testing={testingWheel === supplier.id}
              onUpdate={(updates) => updateWheelSupplier(supplier, updates)}
              onTest={() => testWheelSupplier(supplier)}
              onSaveCredentials={saveWheelCredentials}
            />
          ))}
          {wheelSuppliers.length === 0 && (
            <div className="col-span-2 text-neutral-500 text-sm p-4 bg-neutral-800 rounded-xl border border-neutral-700">
              No wheel suppliers configured. Run database migrations to enable.
            </div>
          )}
        </div>
      </section>

      {/* ============ TIRE SUPPLIERS (TIREWEB) ============ */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🚗</span> Tire Suppliers (via TireWeb)
        </h2>

        {/* TireWeb Credentials */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔗</span>
              <div>
                <h3 className="text-white font-bold">TireWeb API Credentials</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  {tirewebConfig.configured
                    ? "✓ Group token configured"
                    : "⏳ Enter your group token from TireWeb"}
                </p>
              </div>
            </div>
            {!editingTirewebCreds && (
              <button
                onClick={() => setEditingTirewebCreds(true)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                {tirewebConfig.configured ? "Update" : "Configure"}
              </button>
            )}
          </div>

          {editingTirewebCreds && (
            <div className="space-y-4 p-4 bg-neutral-900 rounded-lg border border-neutral-700">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Group Token <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={groupToken}
                  onChange={(e) => setGroupToken(e.target.value)}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                  placeholder="Enter group token from TireWeb"
                />
                <p className="text-xs text-neutral-500 mt-1">Required - provided by Tirewire</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Access Key <span className="text-neutral-500">(optional)</span>
                </label>
                <input
                  type="password"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                  placeholder="Leave blank to use group token"
                />
                <p className="text-xs text-neutral-500 mt-1">If not provided, group token will be used for authentication</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveTirewebCredentials}
                  disabled={savingTireweb === "credentials" || !groupToken}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {savingTireweb === "credentials" ? "Saving..." : "Save Credentials"}
                </button>
                <button
                  onClick={() => {
                    setEditingTirewebCreds(false);
                    setAccessKey("");
                    setGroupToken("");
                  }}
                  className="px-4 py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-neutral-500">
                Contact TireWeb support at{" "}
                <a href="mailto:support@tireweb.com" className="text-red-400 hover:underline">
                  support@tireweb.com
                </a>{" "}
                if you need help with credentials.
              </p>
            </div>
          )}
        </div>

        {/* Tire Supplier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {TIREWEB_SUPPLIERS.map((supplier) => {
            const conn = tirewebConnections.find((c) => c.provider === supplier.provider);
            const isEnabled = conn?.enabled ?? false;
            const connectionId = conn?.connection_id;

            return (
              <TirewebSupplierCard
                key={supplier.provider}
                provider={supplier.provider}
                name={supplier.name}
                icon={supplier.icon}
                description={supplier.description}
                enabled={isEnabled}
                connectionId={connectionId}
                configured={tirewebConfig.configured}
                saving={savingTireweb === supplier.provider}
                testing={testingTireweb === supplier.provider}
                lastTestAt={conn?.last_test_at}
                lastTestStatus={conn?.last_test_status}
                lastTestMessage={conn?.last_test_message}
                onToggle={(enabled) => toggleTirewebConnection(supplier.provider, enabled)}
                onUpdateConnectionId={(id) => updateTirewebConnectionId(supplier.provider, id)}
                onTest={() => testTirewebConnection(supplier.provider)}
              />
            );
          })}
        </div>
      </section>

      {/* Info */}
      <section className="bg-neutral-800/50 rounded-xl border border-neutral-700/50 p-5">
        <h3 className="text-white font-bold mb-2">How TireWeb works</h3>
        <ul className="text-sm text-neutral-400 space-y-2">
          <li><strong>1.</strong> Tirewire provides your Group Token and Connection IDs for each supplier</li>
          <li><strong>2.</strong> Enter the group token above, then add Connection ID for each supplier</li>
          <li><strong>3.</strong> Enable suppliers you want in tire searches</li>
          <li><strong>4.</strong> Inventory aggregates with pricing and TireLibrary images</li>
        </ul>
        <p className="text-xs text-neutral-500 mt-3">
          ℹ️ TireLibrary images will automatically appear for all tires returned through TireWeb, including brands like Lexani, Lionhart, Thunderer, etc.
        </p>
      </section>
    </div>
  );
}

// ============ Wheel Supplier Card ============

function WheelSupplierCard({
  supplier,
  saving,
  testing,
  onUpdate,
  onTest,
  onSaveCredentials,
}: {
  supplier: Supplier;
  saving: boolean;
  testing: boolean;
  onUpdate: (updates: Partial<Supplier>) => void;
  onTest: () => void;
  onSaveCredentials: (provider: string, creds: Record<string, string>) => Promise<void>;
}) {
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [customerNumber, setCustomerNumber] = useState(supplier.customer_number || "");
  const [companyCode, setCompanyCode] = useState(supplier.company_code || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");

  const saveCredentials = async () => {
    setSavingCredentials(true);
    try {
      const creds: Record<string, string> = {};
      if (supplier.provider === "wheelpros") {
        if (username) creds.username = username;
        if (password) creds.password = password;
      } else {
        if (apiKey) creds.apiKey = apiKey;
      }
      if (customerNumber) creds.customerNumber = customerNumber;
      if (companyCode) creds.companyCode = companyCode;

      await onSaveCredentials(supplier.provider, creds);
      setEditingCredentials(false);
      setPassword("");
      setApiKey("");
    } finally {
      setSavingCredentials(false);
    }
  };

  const icon = supplier.provider === "wheelpros" ? "🛞" : supplier.provider === "keystone" ? "🔑" : "📦";

  return (
    <div className={`bg-neutral-800 rounded-xl border p-5 ${supplier.enabled ? "border-green-600/50" : "border-neutral-700"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="text-white font-bold">{supplier.display_name}</h3>
            <span className={`text-xs ${supplier.credentialsConfigured ? "text-green-400" : "text-red-400"}`}>
              {supplier.credentialsConfigured ? "✓ Configured" : "Not configured"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Enabled"
          description={`Show products from ${supplier.display_name}`}
          enabled={supplier.enabled}
          saving={saving}
          onChange={(enabled) => onUpdate({ enabled })}
        />

        {supplier.enabled && (
          <>
            {editingCredentials ? (
              <div className="space-y-3 p-3 bg-neutral-900 rounded-lg border border-neutral-700">
                {supplier.provider === "wheelpros" ? (
                  <>
                    <Input label="Username" value={username} onChange={setUsername} placeholder="WheelPros username" />
                    <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="WheelPros password" />
                  </>
                ) : (
                  <Input label="API Key" type="password" value={apiKey} onChange={setApiKey} placeholder="API key" />
                )}
                <Input label="Customer Number" value={customerNumber} onChange={setCustomerNumber} placeholder="Dealer number" />
                <Input label="Company Code" value={companyCode} onChange={setCompanyCode} placeholder="Company code" />
                <div className="flex gap-2 pt-2">
                  <button onClick={saveCredentials} disabled={savingCredentials} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    {savingCredentials ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditingCredentials(false)} className="px-3 py-1.5 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditingCredentials(true)} className="text-sm text-red-400 hover:text-red-300">
                {supplier.credentialsConfigured ? "Update" : "Configure"} credentials
              </button>
            )}

            <button onClick={onTest} disabled={testing} className="w-full py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600 disabled:opacity-50">
              {testing ? "Testing..." : "Test Connection"}
            </button>

            {supplier.last_test_at && (
              <div className="text-xs text-neutral-500">
                Last tested: {new Date(supplier.last_test_at).toLocaleString()}
                {supplier.last_test_message && (
                  <div className={supplier.last_test_status === "error" ? "text-red-400" : "text-green-400"}>
                    {supplier.last_test_message}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============ TireWeb Supplier Card ============

function TirewebSupplierCard({
  provider,
  name,
  icon,
  description,
  enabled,
  connectionId,
  configured,
  saving,
  testing,
  lastTestAt,
  lastTestStatus,
  lastTestMessage,
  onToggle,
  onUpdateConnectionId,
  onTest,
}: {
  provider: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  connectionId: number | null | undefined;
  configured: boolean;
  saving: boolean;
  testing: boolean;
  lastTestAt: string | null | undefined;
  lastTestStatus: "success" | "error" | null | undefined;
  lastTestMessage: string | null | undefined;
  onToggle: (enabled: boolean) => void;
  onUpdateConnectionId: (id: number) => void;
  onTest: () => void;
}) {
  return (
    <div className={`bg-neutral-800 rounded-xl border p-5 ${enabled ? "border-green-600/50" : "border-neutral-700"}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-white font-bold">{name}</h3>
          <p className="text-xs text-neutral-400">{description}</p>
        </div>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Enabled"
          description="Include in tire searches"
          enabled={enabled}
          saving={saving}
          disabled={!configured}
          onChange={onToggle}
        />

        {configured && (
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Connection ID</label>
            <input
              type="number"
              value={connectionId || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) onUpdateConnectionId(val);
              }}
              className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
              placeholder="from TireWeb"
            />
          </div>
        )}

        {configured && connectionId && (
          <button onClick={onTest} disabled={testing} className="w-full py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600 disabled:opacity-50">
            {testing ? "Testing..." : "Test Connection"}
          </button>
        )}

        {lastTestAt && (
          <div className="text-xs">
            <span className={lastTestStatus === "success" ? "text-green-400" : "text-red-400"}>
              {lastTestStatus === "success" ? "✓ Connected" : "✗ Error"}
            </span>
            {lastTestMessage && <p className="text-neutral-500 mt-1">{lastTestMessage}</p>}
          </div>
        )}

        {!configured && (
          <div className="text-xs text-amber-400">⏳ Configure TireWeb credentials first</div>
        )}
      </div>
    </div>
  );
}

// ============ Shared Components ============

function ToggleSetting({
  label,
  description,
  enabled,
  saving,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-white font-medium text-sm">{label}</div>
        <div className="text-xs text-neutral-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        disabled={saving || disabled}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          saving ? "bg-neutral-600 cursor-wait" : enabled ? "bg-green-600" : "bg-neutral-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-neutral-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}
