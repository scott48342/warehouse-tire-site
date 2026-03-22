"use client";

import { useState, useEffect } from "react";

type SettingValue = {
  value: any;
  updatedAt: string;
};

type Settings = Record<string, SettingValue>;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      setSettings(data.settings || {});
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      await fetchSettings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(null);
    }
  };

  const payments = settings.payments?.value || { stripe_enabled: true };
  const suppliers = settings.suppliers?.value || { wheelpros_enabled: true, keystone_enabled: true };
  const site = settings.site?.value || { maintenance_mode: false };

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
          Configure payments, suppliers, and site settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments */}
        <SettingsCard
          icon="💳"
          title="Payments"
          description="Payment processing configuration"
        >
          <ToggleSetting
            label="Stripe Checkout"
            description="Enable Stripe payment processing"
            enabled={payments.stripe_enabled}
            saving={saving === "payments"}
            onChange={(enabled) =>
              updateSetting("payments", { ...payments, stripe_enabled: enabled })
            }
          />

          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="text-xs text-neutral-500">
              <strong>Note:</strong> Stripe API keys are configured via environment variables
              (STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) and cannot be
              changed here for security.
            </div>
          </div>
        </SettingsCard>

        {/* Suppliers */}
        <SettingsCard
          icon="🏭"
          title="Suppliers"
          description="Supplier integration settings"
        >
          <ToggleSetting
            label="WheelPros"
            description="Wheels and accessories supplier"
            enabled={suppliers.wheelpros_enabled}
            saving={saving === "suppliers"}
            onChange={(enabled) =>
              updateSetting("suppliers", { ...suppliers, wheelpros_enabled: enabled })
            }
          />

          <div className="mt-3">
            <ToggleSetting
              label="Keystone"
              description="Tires supplier"
              enabled={suppliers.keystone_enabled}
              saving={saving === "suppliers"}
              onChange={(enabled) =>
                updateSetting("suppliers", { ...suppliers, keystone_enabled: enabled })
              }
            />
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="text-xs text-neutral-500">
              Disabling a supplier will hide products from that source in search results.
            </div>
          </div>
        </SettingsCard>

        {/* Site */}
        <SettingsCard
          icon="🌐"
          title="Site"
          description="Site-wide settings"
        >
          <ToggleSetting
            label="Maintenance Mode"
            description="Show maintenance page to visitors"
            enabled={site.maintenance_mode}
            saving={saving === "site"}
            onChange={(enabled) =>
              updateSetting("site", { ...site, maintenance_mode: enabled })
            }
            danger
          />

          <div className="mt-4 pt-4 border-t border-neutral-700">
            <div className="text-xs text-neutral-500">
              <strong>Warning:</strong> Enabling maintenance mode will prevent customers
              from accessing the shop.
            </div>
          </div>
        </SettingsCard>

        {/* Future: Multi-tenant */}
        <SettingsCard
          icon="🏢"
          title="Multi-Client"
          description="Multi-tenant configuration"
          disabled
        >
          <div className="text-sm text-neutral-500">
            Multi-client configuration will be available in a future update.
            This will allow running multiple storefronts from a single admin.
          </div>
        </SettingsCard>
      </div>

      {/* Environment Info */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-5">
        <h3 className="text-lg font-bold text-white mb-4">Environment</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <EnvItem label="Node Env" value={process.env.NODE_ENV || "development"} />
          <EnvItem label="Stripe" value={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? "Configured" : "Not set"} />
          <EnvItem label="Database" value="Connected" />
          <EnvItem label="Admin Auth" value="Enabled" />
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  description,
  disabled,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-neutral-800 rounded-xl border border-neutral-700 p-6 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-xs text-neutral-400">{description}</p>
        </div>
      </div>
      {children}
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
