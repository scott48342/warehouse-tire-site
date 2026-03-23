"use client";

import { useState, useEffect } from "react";

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

const TIREWEB_SUPPLIERS = [
  { provider: "tireweb_atd", name: "ATD", icon: "🚚", description: "American Tire Distributors" },
  { provider: "tireweb_ntw", name: "NTW", icon: "🏭", description: "National Tire Wholesale" },
  { provider: "tireweb_usautoforce", name: "US AutoForce", icon: "⚡", description: "US AutoForce Distribution" },
];

export default function SuppliersPage() {
  const [connections, setConnections] = useState<TirewebConnection[]>([]);
  const [config, setConfig] = useState<TirewebConfig>({ access_key: null, group_token: null, configured: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [editingCredentials, setEditingCredentials] = useState(false);
  
  // Credential form
  const [accessKey, setAccessKey] = useState("");
  const [groupToken, setGroupToken] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/suppliers/tireweb");
      const data = await res.json();
      setConnections(data.connections || []);
      setConfig(data.config || { access_key: null, group_token: null, configured: false });
    } catch (err) {
      console.error("Failed to fetch TireWeb config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveCredentials = async () => {
    setSaving("credentials");
    try {
      const res = await fetch("/api/admin/suppliers/tireweb/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey, groupToken }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setEditingCredentials(false);
      setAccessKey("");
      setGroupToken("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const toggleConnection = async (provider: string, enabled: boolean) => {
    setSaving(provider);
    try {
      const res = await fetch("/api/admin/suppliers/tireweb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const updateConnectionId = async (provider: string, connectionId: number) => {
    setSaving(provider);
    try {
      const res = await fetch("/api/admin/suppliers/tireweb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, connection_id: connectionId }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const testConnection = async (provider: string) => {
    setTesting(provider);
    try {
      const res = await fetch("/api/admin/suppliers/tireweb/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Suppliers</h1>
        <p className="text-neutral-400 mt-1">
          Manage tire supplier connections via TireWeb/Tirewire
        </p>
      </div>

      {/* TireWeb Credentials */}
      <section className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔗</span>
            <div>
              <h2 className="text-lg font-bold text-white">TireWeb API Credentials</h2>
              <p className="text-sm text-neutral-400 mt-1">
                {config.configured 
                  ? "✓ Access key and group token configured"
                  : "⏳ Waiting for Tirewire to provide credentials"}
              </p>
            </div>
          </div>
          {!editingCredentials && (
            <button
              onClick={() => setEditingCredentials(true)}
              className="text-sm text-red-400 hover:text-red-300"
            >
              {config.configured ? "Update" : "Configure"}
            </button>
          )}
        </div>

        {editingCredentials && (
          <div className="space-y-4 p-4 bg-neutral-900 rounded-lg border border-neutral-700">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Tirewire Access Key
              </label>
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                placeholder="Enter access key from Tirewire"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1">
                Group Token
              </label>
              <input
                type="password"
                value={groupToken}
                onChange={(e) => setGroupToken(e.target.value)}
                className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                placeholder="Enter group token from Tirewire"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveCredentials}
                disabled={saving === "credentials" || !accessKey || !groupToken}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving === "credentials" ? "Saving..." : "Save Credentials"}
              </button>
              <button
                onClick={() => {
                  setEditingCredentials(false);
                  setAccessKey("");
                  setGroupToken("");
                }}
                className="px-4 py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              🔒 Credentials are encrypted and stored securely. Contact Tirewire at{" "}
              <a href="mailto:developer@tirewire.com" className="text-red-400 hover:underline">
                developer@tirewire.com
              </a>{" "}
              to get your access key and group token.
            </p>
          </div>
        )}
      </section>

      {/* Supplier Connections */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🏭</span> Tire Supplier Connections
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {TIREWEB_SUPPLIERS.map((supplier) => {
            const conn = connections.find((c) => c.provider === supplier.provider);
            const isEnabled = conn?.enabled ?? false;
            const connectionId = conn?.connection_id;
            const isSaving = saving === supplier.provider;
            const isTesting = testing === supplier.provider;

            return (
              <div
                key={supplier.provider}
                className={`bg-neutral-800 rounded-xl border p-5 ${
                  isEnabled ? "border-green-600/50" : "border-neutral-700"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{supplier.icon}</span>
                  <div>
                    <h3 className="text-white font-bold">{supplier.name}</h3>
                    <p className="text-xs text-neutral-400">{supplier.description}</p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-white font-medium text-sm">Enabled</div>
                    <div className="text-xs text-neutral-400">
                      Include in inventory searches
                    </div>
                  </div>
                  <button
                    onClick={() => toggleConnection(supplier.provider, !isEnabled)}
                    disabled={isSaving || !config.configured}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      isSaving
                        ? "bg-neutral-600 cursor-wait"
                        : isEnabled
                        ? "bg-green-600"
                        : "bg-neutral-600"
                    } ${!config.configured ? "opacity-50 cursor-not-allowed" : ""}`}
                    title={!config.configured ? "Configure TireWeb credentials first" : ""}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Connection ID */}
                {config.configured && (
                  <div className="mb-4">
                    <label className="block text-xs text-neutral-400 mb-1">
                      Tirewire Connection ID
                    </label>
                    <input
                      type="number"
                      value={connectionId || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) updateConnectionId(supplier.provider, val);
                      }}
                      className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                      placeholder="From Tirewire setup"
                    />
                  </div>
                )}

                {/* Test Button */}
                {config.configured && connectionId && (
                  <button
                    onClick={() => testConnection(supplier.provider)}
                    disabled={isTesting}
                    className="w-full py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600 disabled:opacity-50"
                  >
                    {isTesting ? "Testing..." : "Test Connection"}
                  </button>
                )}

                {/* Status */}
                {conn?.last_test_at && (
                  <div className="mt-3 text-xs">
                    <span
                      className={
                        conn.last_test_status === "success"
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {conn.last_test_status === "success" ? "✓ Connected" : "✗ Error"}
                    </span>
                    {conn.last_test_message && (
                      <p className="text-neutral-500 mt-1">{conn.last_test_message}</p>
                    )}
                  </div>
                )}

                {!config.configured && (
                  <div className="text-xs text-amber-400 mt-2">
                    ⏳ Waiting for TireWeb credentials
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Info */}
      <section className="bg-neutral-800/50 rounded-xl border border-neutral-700/50 p-5">
        <h3 className="text-white font-bold mb-2">How it works</h3>
        <ul className="text-sm text-neutral-400 space-y-2">
          <li>
            <strong>1.</strong> Tirewire provides your Access Key, Group Token, and Connection IDs for each supplier
          </li>
          <li>
            <strong>2.</strong> Enter the shared credentials above, then add the Connection ID for each supplier
          </li>
          <li>
            <strong>3.</strong> Enable suppliers you want to include in tire searches
          </li>
          <li>
            <strong>4.</strong> Inventory from enabled suppliers will be aggregated with pricing and TireLibrary images
          </li>
        </ul>
      </section>
    </div>
  );
}
