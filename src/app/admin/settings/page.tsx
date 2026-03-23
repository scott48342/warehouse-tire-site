"use client";

import { useState, useEffect } from "react";

type Gateway = {
  id: string;
  provider: string;
  display_name: string;
  enabled: boolean;
  mode: "test" | "live";
  priority: number;
  config: Record<string, any>;
  secretKeyConfigured: boolean | null;
  publishableKeyConfigured: boolean | null;
  updated_at: string;
};

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

type SiteSettings = {
  maintenance_mode: boolean;
};

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  notifyEmail: string;
  hasPassword?: boolean;
};

export default function SettingsPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({ maintenance_mode: false });
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    enabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    fromEmail: "",
    fromName: "Warehouse Tire",
    notifyEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [gatewaysRes, suppliersRes, settingsRes, emailRes] = await Promise.all([
        fetch("/api/admin/settings/gateways"),
        fetch("/api/admin/settings/suppliers"),
        fetch("/api/admin/settings"),
        fetch("/api/admin/settings/email"),
      ]);

      const gatewaysData = await gatewaysRes.json();
      const suppliersData = await suppliersRes.json();
      const settingsData = await settingsRes.json();
      const emailData = await emailRes.json();

      setGateways(gatewaysData.gateways || []);
      setSuppliers(suppliersData.suppliers || []);
      setSiteSettings(settingsData.settings?.site?.value || { maintenance_mode: false });
      setEmailSettings(emailData);
      setNeedsMigration(gatewaysData.needsMigration || suppliersData.needsMigration);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateGateway = async (gateway: Gateway, updates: Partial<Gateway>) => {
    setSaving(gateway.id);
    try {
      const res = await fetch("/api/admin/settings/gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gateway.id, provider: gateway.provider, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const updateSupplier = async (supplier: Supplier, updates: Partial<Supplier>) => {
    setSaving(supplier.id);
    try {
      const res = await fetch("/api/admin/settings/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: supplier.id, provider: supplier.provider, ...updates }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const testSupplier = async (supplier: Supplier) => {
    setTesting(supplier.id);
    try {
      const res = await fetch("/api/admin/settings/suppliers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: supplier.provider }),
      });
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTesting(null);
    }
  };

  const saveSupplierCredentials = async (provider: string, credentials: Record<string, string>) => {
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
      await fetchData();
    } catch (err: any) {
      alert(err.message);
      throw err;
    }
  };

  const updateSiteSetting = async (key: string, value: any) => {
    setSaving("site");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "site", value: { ...siteSettings, [key]: value } }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-neutral-400 mt-1">
          Configure payments, email, and site settings
        </p>
      </div>

      {needsMigration && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 text-amber-300">
          <strong>Migration Required:</strong> Run the database migration to enable multi-gateway and multi-supplier support.
          <code className="block mt-2 bg-neutral-800 p-2 rounded text-sm">
            npx drizzle-kit push
          </code>
        </div>
      )}

      {/* Payment Gateways */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>💳</span> Payment Gateways
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {gateways.map((gateway) => (
            <GatewayCard
              key={gateway.id}
              gateway={gateway}
              saving={saving === gateway.id}
              onUpdate={(updates) => updateGateway(gateway, updates)}
            />
          ))}
          
          {/* Coming Soon Cards */}
          <ComingSoonCard
            icon="🏦"
            title="Square"
            description="Square payment processing"
          />
          <ComingSoonCard
            icon="🅿️"
            title="PayPal"
            description="PayPal checkout"
          />
        </div>
      </section>

      {/* Site Settings */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>🌐</span> Site Settings
        </h2>
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
          <ToggleSetting
            label="Maintenance Mode"
            description="Show maintenance page to visitors"
            enabled={siteSettings.maintenance_mode}
            saving={saving === "site"}
            danger
            onChange={(enabled) => updateSiteSetting("maintenance_mode", enabled)}
          />
          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="text-xs text-neutral-500">
              <strong>Warning:</strong> Enabling maintenance mode will prevent customers
              from accessing the shop.
            </div>
          </div>
        </div>
      </section>

      {/* Email Settings */}
      <section>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>📧</span> Email Notifications
        </h2>
        <EmailSettingsCard
          settings={emailSettings}
          saving={saving === "email"}
          testing={testing === "email"}
          onSave={async (updates) => {
            setSaving("email");
            try {
              const res = await fetch("/api/admin/settings/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
              });
              if (!res.ok) throw new Error("Failed to save");
              await fetchData();
            } catch (err: any) {
              alert(err.message);
            } finally {
              setSaving(null);
            }
          }}
          onTest={async (toEmail) => {
            setTesting("email");
            try {
              const res = await fetch("/api/admin/settings/email", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testTo: toEmail }),
              });
              const data = await res.json();
              if (data.ok) {
                alert("Test email sent successfully!");
              } else {
                alert(`Failed: ${data.error}`);
              }
            } catch (err: any) {
              alert(err.message);
            } finally {
              setTesting(null);
            }
          }}
        />
      </section>

      {/* Environment Info */}
      <section className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
        <h3 className="text-lg font-bold text-white mb-4">Environment</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <EnvItem label="Node Env" value={process.env.NODE_ENV || "development"} />
          <EnvItem 
            label="Stripe Key" 
            value={gateways.find(g => g.provider === 'stripe')?.secretKeyConfigured ? "Configured" : "Not set"} 
          />
          <EnvItem label="Database" value="Connected" />
          <EnvItem label="Admin Auth" value="Enabled" />
        </div>
      </section>
    </div>
  );
}

function GatewayCard({
  gateway,
  saving,
  onUpdate,
}: {
  gateway: Gateway;
  saving: boolean;
  onUpdate: (updates: Partial<Gateway>) => void;
}) {
  const isStripe = gateway.provider === "stripe";
  const isManual = gateway.provider === "manual";

  return (
    <div className={`bg-neutral-800 rounded-xl border p-6 ${gateway.enabled ? "border-green-600/50" : "border-neutral-700"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isStripe ? "💳" : isManual ? "📞" : "💰"}</span>
          <div>
            <h3 className="text-white font-bold">{gateway.display_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {gateway.enabled && (
                <span className={`text-xs px-2 py-0.5 rounded ${
                  gateway.mode === "live" ? "bg-green-600 text-white" : "bg-amber-600 text-white"
                }`}>
                  {gateway.mode === "live" ? "Live" : "Test Mode"}
                </span>
              )}
              {isStripe && gateway.secretKeyConfigured === false && (
                <span className="text-xs text-red-400">API key not configured</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Enabled"
          description={`Accept payments via ${gateway.display_name}`}
          enabled={gateway.enabled}
          saving={saving}
          onChange={(enabled) => onUpdate({ enabled })}
        />

        {isStripe && gateway.enabled && (
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => onUpdate({ mode: "test" })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  gateway.mode === "test"
                    ? "bg-amber-600 text-white"
                    : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                }`}
              >
                Test
              </button>
              <button
                onClick={() => onUpdate({ mode: "live" })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  gateway.mode === "live"
                    ? "bg-green-600 text-white"
                    : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                }`}
              >
                Live
              </button>
            </div>
          </div>
        )}

        {isManual && gateway.enabled && (
          <div className="text-sm text-neutral-400">
            Customers will be prompted to call for payment completion.
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-700 text-xs text-neutral-500">
        {isStripe
          ? "API keys configured via environment variables (STRIPE_SECRET_KEY)"
          : isManual
          ? "No API keys required"
          : "Configure via environment variables"}
      </div>
    </div>
  );
}

function SupplierCard({
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
  // Credential fields (only shown when editing)
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
      // Clear sensitive fields after save
      setPassword("");
      setApiKey("");
    } finally {
      setSavingCredentials(false);
    }
  };

  const credentialStatusText = supplier.credentialsConfigured
    ? supplier.credentialSource === "db"
      ? "✓ Configured (admin-managed)"
      : "✓ Configured (from environment)"
    : "Not configured";

  const credentialStatusColor = supplier.credentialsConfigured
    ? "text-green-400"
    : "text-red-400";

  return (
    <div className={`bg-neutral-800 rounded-xl border p-6 ${supplier.enabled ? "border-green-600/50" : "border-neutral-700"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {supplier.provider === "wheelpros" ? "🛞" : supplier.provider === "keystone" ? "🔑" : "📦"}
          </span>
          <div>
            <h3 className="text-white font-bold">{supplier.display_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs ${credentialStatusColor}`}>
                {credentialStatusText}
              </span>
              {supplier.last_test_status && (
                <span className={`text-xs ${
                  supplier.last_test_status === "success" ? "text-green-400" : "text-red-400"
                }`}>
                  {supplier.last_test_status === "success" ? "• Connected" : "• Error"}
                </span>
              )}
            </div>
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
                <div className="text-sm font-medium text-neutral-300 mb-2">
                  🔐 Configure Credentials
                </div>
                
                {supplier.provider === "wheelpros" ? (
                  <>
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                        placeholder="WheelPros API username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-neutral-400 mb-1">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                        placeholder="WheelPros API password"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                      placeholder="API key"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Customer/Dealer Number</label>
                  <input
                    type="text"
                    value={customerNumber}
                    onChange={(e) => setCustomerNumber(e.target.value)}
                    className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                    placeholder="Your dealer number"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Company Code</label>
                  <input
                    type="text"
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value)}
                    className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                    placeholder="Company code (if required)"
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveCredentials}
                    disabled={savingCredentials}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingCredentials ? "Saving..." : "Save Credentials"}
                  </button>
                  <button
                    onClick={() => setEditingCredentials(false)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="text-xs text-neutral-500 mt-2">
                  🔒 Credentials are encrypted and stored securely. They never leave the server.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {(supplier.customer_number || supplier.company_code) && (
                  <div className="text-sm">
                    {supplier.customer_number && (
                      <div className="text-neutral-400">
                        Customer #: <span className="text-white">{supplier.customer_number}</span>
                      </div>
                    )}
                    {supplier.company_code && (
                      <div className="text-neutral-400">
                        Company Code: <span className="text-white">{supplier.company_code}</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setEditingCredentials(true)}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  {supplier.credentialsConfigured ? "Update" : "Configure"} credentials
                </button>
              </div>
            )}

            <button
              onClick={onTest}
              disabled={testing}
              className="w-full py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600 disabled:opacity-50"
            >
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

      <div className="mt-4 pt-4 border-t border-neutral-700 text-xs text-neutral-500">
        {supplier.credentialSource === "db" 
          ? "🔐 Credentials managed via admin settings (encrypted)"
          : supplier.credentialSource === "env"
          ? "⚙️ Using environment variables (migrate to admin settings recommended)"
          : "Configure credentials above to enable this supplier"}
      </div>
    </div>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-neutral-800/50 rounded-xl border border-neutral-700/50 border-dashed p-6 opacity-60">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-white font-bold">{title}</h3>
          <span className="text-xs bg-neutral-700 text-neutral-400 px-2 py-0.5 rounded">
            Coming Soon
          </span>
        </div>
      </div>
      <p className="text-sm text-neutral-500">{description}</p>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  enabled,
  saving,
  danger,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  danger?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-white font-medium">{label}</div>
        <div className="text-xs text-neutral-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        disabled={saving}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          saving
            ? "bg-neutral-600 cursor-wait"
            : enabled
            ? danger
              ? "bg-red-600"
              : "bg-green-600"
            : "bg-neutral-600"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function EnvItem({ label, value }: { label: string; value: string }) {
  const isGood = value === "Connected" || value === "Configured" || value === "Enabled";

  return (
    <div>
      <div className="text-neutral-500 text-xs">{label}</div>
      <div className={`font-medium ${isGood ? "text-green-400" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function EmailSettingsCard({
  settings,
  saving,
  testing,
  onSave,
  onTest,
}: {
  settings: EmailSettings;
  saving: boolean;
  testing: boolean;
  onSave: (updates: Partial<EmailSettings>) => Promise<void>;
  onTest: (toEmail: string) => Promise<void>;
}) {
  const [form, setForm] = useState(settings);
  const [testEmail, setTestEmail] = useState("");

  // Update form when settings change
  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    await onSave(form);
  };

  const handleTest = async () => {
    const email = testEmail || form.notifyEmail || form.fromEmail;
    if (!email) {
      alert("Enter an email to send test to");
      return;
    }
    await onTest(email);
  };

  return (
    <div className={`bg-neutral-800 rounded-xl border p-6 ${form.enabled ? "border-green-600/50" : "border-neutral-700"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📧</span>
          <div>
            <h3 className="text-white font-bold">Email Configuration</h3>
            <div className="text-xs text-neutral-400 mt-1">
              {form.enabled 
                ? settings.hasPassword 
                  ? "✓ SMTP configured" 
                  : "⚠️ SMTP password not set"
                : "Email notifications disabled"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ToggleSetting
          label="Enable Email"
          description="Send order confirmations and notifications"
          enabled={form.enabled}
          saving={saving}
          onChange={(enabled) => setForm({ ...form, enabled })}
        />

        {form.enabled && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 587 })}
                  className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  placeholder="587"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  SMTP Username
                </label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  SMTP Password {settings.hasPassword && <span className="text-green-400">(set)</span>}
                </label>
                <input
                  type="password"
                  value={form.smtpPass}
                  onChange={(e) => setForm({ ...form, smtpPass: e.target.value })}
                  className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  placeholder={settings.hasPassword ? "••••••••" : "App password"}
                />
              </div>
            </div>

            <div className="border-t border-neutral-700 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                    className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                    placeholder="orders@yourstore.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={form.fromName}
                    onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                    className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                    placeholder="Warehouse Tire"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-700 pt-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Admin Notification Email
                </label>
                <input
                  type="email"
                  value={form.notifyEmail}
                  onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })}
                  className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  placeholder="you@example.com"
                />
                <div className="text-xs text-neutral-500 mt-1">
                  You&apos;ll receive a copy of every order confirmation
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
              
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="flex-1 h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  placeholder="Test email to..."
                />
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="px-4 py-2 rounded-lg bg-neutral-700 text-white text-sm font-medium hover:bg-neutral-600 disabled:opacity-50"
                >
                  {testing ? "Sending..." : "Send Test"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-700 text-xs text-neutral-500">
        <strong>Gmail users:</strong> Use an App Password (Google Account → Security → App Passwords).
        Regular passwords won&apos;t work with 2FA enabled.
      </div>
    </div>
  );
}
