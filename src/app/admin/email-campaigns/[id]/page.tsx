"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Campaign = {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  subject: string;
  previewText?: string;
  fromName?: string;
  replyTo?: string;
  contentJson: { blocks: ContentBlock[] };
  audienceRulesJson: AudienceRules;
  includeFreeShippingBanner?: boolean;
  includePriceMatch?: boolean;
  utmCampaign?: string;
  totalRecipients: number;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
  isTest?: boolean;
  notes?: string;
};

type ContentBlock = {
  type: string;
  data: Record<string, any>;
};

type AudienceRules = {
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYearMin?: number;
  vehicleYearMax?: number;
  sources?: string[];
  hasCart?: boolean;
  hasPurchase?: boolean;
  activeWithinDays?: number;
  recentCampaignExcludeDays?: number;
  includeTest?: boolean;
};

type AudiencePreview = {
  totalCount: number;
  sampleEmails: string[];
  breakdown: {
    bySource: Record<string, number>;
    byMake?: Record<string, number>;
    withVehicle: number;
    withCart: number;
    withPurchase: number;
  };
  exclusions: {
    unsubscribed: number;
    suppressed: number;
    recentCampaign: number;
    test: number;
  };
};

const BLOCK_TYPES = [
  { type: "hero", label: "Hero Banner", icon: "🎯" },
  { type: "promo_banner", label: "Promo Banner", icon: "🏷️" },
  { type: "text_block", label: "Text Block", icon: "📝" },
  { type: "cta_button", label: "CTA Button", icon: "🔘" },
  { type: "product_grid", label: "Product Grid", icon: "🛒" },
  { type: "divider", label: "Divider", icon: "➖" },
];

const SOURCE_OPTIONS = [
  { value: "newsletter", label: "Newsletter Signup" },
  { value: "checkout", label: "Checkout" },
  { value: "cart_save", label: "Cart Save" },
  { value: "exit_intent", label: "Exit Intent" },
  { value: "quote", label: "Quote Request" },
];

export default function CampaignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "audience" | "settings">("content");
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Modals
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [showTestEmail, setShowTestEmail] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch campaign");
      setCampaign(data.campaign);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCampaign = async () => {
    if (!campaign) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaign.name,
          subject: campaign.subject,
          previewText: campaign.previewText,
          fromName: campaign.fromName,
          replyTo: campaign.replyTo,
          contentJson: campaign.contentJson,
          audienceRulesJson: campaign.audienceRulesJson,
          includeFreeShippingBanner: campaign.includeFreeShippingBanner,
          includePriceMatch: campaign.includePriceMatch,
          utmCampaign: campaign.utmCampaign,
          notes: campaign.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setMessage({ type: "success", text: "Campaign saved" });
      setCampaign(data.campaign);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const previewAudience = async () => {
    setPreviewLoading(true);
    setAudiencePreview(null);

    try {
      // Save first to ensure rules are persisted
      await saveCampaign();

      const res = await fetch(`/api/admin/email-campaigns/${id}/audience-preview`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to preview audience");

      setAudiencePreview(data.preview);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  const buildAudience = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/build-audience`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build audience");

      setMessage({ type: "success", text: `Built audience: ${data.recipientCount} recipients` });
      fetchCampaign();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, body?: object) => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);

      setMessage({ type: "success", text: `Campaign ${action} successful` });
      fetchCampaign();
      setShowSchedule(false);
      setShowTestEmail(false);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    if (!campaign) return;
    setCampaign({ ...campaign, [field]: value });
  };

  const updateAudienceRule = (field: string, value: any) => {
    if (!campaign) return;
    setCampaign({
      ...campaign,
      audienceRulesJson: { ...campaign.audienceRulesJson, [field]: value },
    });
  };

  const addBlock = (type: string) => {
    if (!campaign) return;
    const newBlock: ContentBlock = {
      type,
      data: getDefaultBlockData(type),
    };
    setCampaign({
      ...campaign,
      contentJson: {
        blocks: [...(campaign.contentJson?.blocks || []), newBlock],
      },
    });
  };

  const updateBlock = (index: number, data: Record<string, any>) => {
    if (!campaign) return;
    const blocks = [...(campaign.contentJson?.blocks || [])];
    blocks[index] = { ...blocks[index], data };
    setCampaign({
      ...campaign,
      contentJson: { blocks },
    });
  };

  const removeBlock = (index: number) => {
    if (!campaign) return;
    const blocks = [...(campaign.contentJson?.blocks || [])];
    blocks.splice(index, 1);
    setCampaign({
      ...campaign,
      contentJson: { blocks },
    });
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    if (!campaign) return;
    const blocks = [...(campaign.contentJson?.blocks || [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];
    setCampaign({
      ...campaign,
      contentJson: { blocks },
    });
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-neutral-400">Loading campaign...</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-red-400">{error || "Campaign not found"}</div>
        <Link href="/admin/email-campaigns" className="text-blue-400 hover:underline block text-center">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  const isEditable = campaign.status === "draft" || campaign.status === "scheduled";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/email-campaigns"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  campaign.status === "draft"
                    ? "bg-neutral-600"
                    : campaign.status === "scheduled"
                    ? "bg-blue-600"
                    : campaign.status === "sending"
                    ? "bg-yellow-600"
                    : campaign.status === "sent"
                    ? "bg-green-600"
                    : "bg-neutral-600"
                }`}
              >
                {campaign.status}
              </span>
              <span className="text-neutral-400 text-sm">
                {campaign.totalRecipients} recipients
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isEditable && (
            <>
              <button
                onClick={() => setShowTestEmail(true)}
                className="px-3 py-2 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600"
              >
                Send Test
              </button>
              <button
                onClick={saveCampaign}
                disabled={saving}
                className="px-3 py-2 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
          {campaign.status === "draft" && (
            <>
              <button
                onClick={() => setShowSchedule(true)}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Schedule
              </button>
              <button
                onClick={() => handleAction("start-now")}
                disabled={saving}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Start Now
              </button>
            </>
          )}
          {campaign.status === "scheduled" && (
            <button
              onClick={() => handleAction("cancel")}
              disabled={saving}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {campaign.status === "sending" && (
            <button
              onClick={() => handleAction("pause")}
              disabled={saving}
              className="px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              Pause
            </button>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => handleAction("resume")}
              disabled={saving}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Resume
            </button>
          )}
          <Link
            href={`/admin/email-campaigns/${id}/stats`}
            className="px-3 py-2 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600"
          >
            📊 Stats
          </Link>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-900/50 border border-green-700 text-green-300"
              : "bg-red-900/50 border border-red-700 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-neutral-800 p-1 rounded-lg w-fit">
        {(["content", "audience", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-red-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Tab */}
      {activeTab === "content" && (
        <div className="space-y-6">
          {/* Email Details */}
          <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
            <h2 className="text-lg font-bold text-white mb-4">Email Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-neutral-400 mb-1">Subject Line *</label>
                <input
                  type="text"
                  value={campaign.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-neutral-400 mb-1">Preview Text</label>
                <input
                  type="text"
                  value={campaign.previewText || ""}
                  onChange={(e) => updateField("previewText", e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="Shown in email client preview"
                />
              </div>
            </div>
          </div>

          {/* Content Blocks */}
          <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Content Blocks</h2>
              {isEditable && (
                <div className="flex gap-2">
                  {BLOCK_TYPES.map((bt) => (
                    <button
                      key={bt.type}
                      onClick={() => addBlock(bt.type)}
                      className="px-2 py-1 text-sm bg-neutral-700 text-white rounded hover:bg-neutral-600"
                      title={bt.label}
                    >
                      {bt.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {campaign.contentJson?.blocks?.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 border-2 border-dashed border-neutral-700 rounded-lg">
                No content blocks yet. Add blocks using the buttons above.
              </div>
            ) : (
              <div className="space-y-3">
                {campaign.contentJson?.blocks?.map((block, idx) => (
                  <BlockEditor
                    key={idx}
                    block={block}
                    index={idx}
                    total={campaign.contentJson.blocks.length}
                    isEditable={isEditable}
                    onUpdate={(data) => updateBlock(idx, data)}
                    onRemove={() => removeBlock(idx)}
                    onMove={(dir) => moveBlock(idx, dir)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audience Tab */}
      {activeTab === "audience" && (
        <div className="space-y-6">
          <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
            <h2 className="text-lg font-bold text-white mb-4">Audience Targeting</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Vehicle Make</label>
                <input
                  type="text"
                  value={campaign.audienceRulesJson?.vehicleMake || ""}
                  onChange={(e) => updateAudienceRule("vehicleMake", e.target.value || undefined)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="e.g., Ford"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Vehicle Model</label>
                <input
                  type="text"
                  value={campaign.audienceRulesJson?.vehicleModel || ""}
                  onChange={(e) => updateAudienceRule("vehicleModel", e.target.value || undefined)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="e.g., Mustang"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Year Min</label>
                <input
                  type="number"
                  value={campaign.audienceRulesJson?.vehicleYearMin || ""}
                  onChange={(e) => updateAudienceRule("vehicleYearMin", e.target.value ? parseInt(e.target.value) : undefined)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="e.g., 2015"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Year Max</label>
                <input
                  type="number"
                  value={campaign.audienceRulesJson?.vehicleYearMax || ""}
                  onChange={(e) => updateAudienceRule("vehicleYearMax", e.target.value ? parseInt(e.target.value) : undefined)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="e.g., 2024"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-neutral-400 mb-1">Signup Sources</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCE_OPTIONS.map((src) => {
                    const selected = campaign.audienceRulesJson?.sources?.includes(src.value);
                    return (
                      <button
                        key={src.value}
                        onClick={() => {
                          const current = campaign.audienceRulesJson?.sources || [];
                          const updated = selected
                            ? current.filter((s) => s !== src.value)
                            : [...current, src.value];
                          updateAudienceRule("sources", updated.length > 0 ? updated : undefined);
                        }}
                        disabled={!isEditable}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selected
                            ? "bg-red-600 text-white"
                            : "bg-neutral-700 text-neutral-300"
                        } disabled:opacity-50`}
                      >
                        {src.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Active Within (days)</label>
                <input
                  type="number"
                  value={campaign.audienceRulesJson?.activeWithinDays || ""}
                  onChange={(e) => updateAudienceRule("activeWithinDays", e.target.value ? parseInt(e.target.value) : undefined)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="e.g., 90"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Exclude Recent Campaign (days)</label>
                <input
                  type="number"
                  value={campaign.audienceRulesJson?.recentCampaignExcludeDays || 7}
                  onChange={(e) => updateAudienceRule("recentCampaignExcludeDays", parseInt(e.target.value) || 7)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                />
              </div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={campaign.audienceRulesJson?.hasCart || false}
                    onChange={(e) => updateAudienceRule("hasCart", e.target.checked || undefined)}
                    disabled={!isEditable}
                    className="rounded bg-neutral-700 border-neutral-600"
                  />
                  Has Abandoned Cart
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={campaign.audienceRulesJson?.hasPurchase || false}
                    onChange={(e) => updateAudienceRule("hasPurchase", e.target.checked || undefined)}
                    disabled={!isEditable}
                    className="rounded bg-neutral-700 border-neutral-600"
                  />
                  Has Purchased
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={campaign.audienceRulesJson?.includeTest || false}
                    onChange={(e) => updateAudienceRule("includeTest", e.target.checked || undefined)}
                    disabled={!isEditable}
                    className="rounded bg-neutral-700 border-neutral-600"
                  />
                  Include Test Subscribers
                </label>
              </div>
            </div>

            {/* Preview Audience */}
            <div className="mt-6 pt-6 border-t border-neutral-700">
              <div className="flex items-center gap-4">
                <button
                  onClick={previewAudience}
                  disabled={previewLoading || !isEditable}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {previewLoading ? "Loading..." : "Preview Audience"}
                </button>
                {isEditable && campaign.status === "draft" && (
                  <button
                    onClick={buildAudience}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Build Recipient List
                  </button>
                )}
              </div>

              {audiencePreview && (
                <div className="mt-4 bg-neutral-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-white mb-2">
                    {audiencePreview.totalCount.toLocaleString()} subscribers
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-neutral-400">With Vehicle</div>
                      <div className="text-white">{audiencePreview.breakdown.withVehicle}</div>
                    </div>
                    <div>
                      <div className="text-neutral-400">With Cart</div>
                      <div className="text-white">{audiencePreview.breakdown.withCart}</div>
                    </div>
                    <div>
                      <div className="text-neutral-400">With Purchase</div>
                      <div className="text-white">{audiencePreview.breakdown.withPurchase}</div>
                    </div>
                  </div>
                  {audiencePreview.sampleEmails.length > 0 && (
                    <div className="mt-3 text-xs text-neutral-400">
                      Sample: {audiencePreview.sampleEmails.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
            <h2 className="text-lg font-bold text-white mb-4">Email Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">From Name</label>
                <input
                  type="text"
                  value={campaign.fromName || ""}
                  onChange={(e) => updateField("fromName", e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="Warehouse Tire Direct"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Reply-To Email</label>
                <input
                  type="email"
                  value={campaign.replyTo || ""}
                  onChange={(e) => updateField("replyTo", e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="support@warehousetiredirect.com"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">UTM Campaign</label>
                <input
                  type="text"
                  value={campaign.utmCampaign || ""}
                  onChange={(e) => updateField("utmCampaign", e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white disabled:opacity-50"
                  placeholder="summer-tire-sale-2026"
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={campaign.includeFreeShippingBanner || false}
                    onChange={(e) => updateField("includeFreeShippingBanner", e.target.checked)}
                    disabled={!isEditable}
                    className="rounded bg-neutral-700 border-neutral-600"
                  />
                  Free Shipping Banner
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-300">
                  <input
                    type="checkbox"
                    checked={campaign.includePriceMatch || false}
                    onChange={(e) => updateField("includePriceMatch", e.target.checked)}
                    disabled={!isEditable}
                    className="rounded bg-neutral-700 border-neutral-600"
                  />
                  Price Match Badge
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-neutral-400 mb-1">Internal Notes</label>
                <textarea
                  value={campaign.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-24 rounded-lg bg-neutral-700 border border-neutral-600 px-3 py-2 text-white disabled:opacity-50 resize-none"
                  placeholder="Internal notes about this campaign..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-md w-full p-6 border border-neutral-700">
            <h2 className="text-xl font-bold text-white mb-4">Schedule Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Send Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSchedule(false)}
                  className="flex-1 h-10 rounded-lg bg-neutral-700 text-white font-medium hover:bg-neutral-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction("schedule", { scheduledFor: new Date(scheduleDate).toISOString() })}
                  disabled={!scheduleDate || saving}
                  className="flex-1 h-10 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestEmail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-md w-full p-6 border border-neutral-700">
            <h2 className="text-xl font-bold text-white mb-4">Send Test Email</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Email Address</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                  placeholder="your@email.com"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTestEmail(false)}
                  className="flex-1 h-10 rounded-lg bg-neutral-700 text-white font-medium hover:bg-neutral-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction("send-test", { email: testEmail })}
                  disabled={!testEmail || saving}
                  className="flex-1 h-10 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Sending..." : "Send Test"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Block Editor Component
function BlockEditor({
  block,
  index,
  total,
  isEditable,
  onUpdate,
  onRemove,
  onMove,
}: {
  block: ContentBlock;
  index: number;
  total: number;
  isEditable: boolean;
  onUpdate: (data: Record<string, any>) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const blockInfo = BLOCK_TYPES.find((b) => b.type === block.type);

  return (
    <div className="bg-neutral-700/50 rounded-lg p-4 border border-neutral-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{blockInfo?.icon || "📦"}</span>
          <span className="text-sm font-medium text-white">{blockInfo?.label || block.type}</span>
        </div>
        {isEditable && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMove("up")}
              disabled={index === 0}
              className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
            >
              ↑
            </button>
            <button
              onClick={() => onMove("down")}
              disabled={index === total - 1}
              className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
            >
              ↓
            </button>
            <button
              onClick={onRemove}
              className="p-1 text-neutral-400 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Block-specific editors */}
      {block.type === "hero" && (
        <div className="space-y-2">
          <input
            type="text"
            value={block.data.headline || ""}
            onChange={(e) => onUpdate({ ...block.data, headline: e.target.value })}
            disabled={!isEditable}
            className="w-full h-9 rounded bg-neutral-600 border border-neutral-500 px-2 text-white text-sm disabled:opacity-50"
            placeholder="Headline"
          />
          <input
            type="text"
            value={block.data.subheadline || ""}
            onChange={(e) => onUpdate({ ...block.data, subheadline: e.target.value })}
            disabled={!isEditable}
            className="w-full h-9 rounded bg-neutral-600 border border-neutral-500 px-2 text-white text-sm disabled:opacity-50"
            placeholder="Subheadline"
          />
        </div>
      )}

      {block.type === "promo_banner" && (
        <input
          type="text"
          value={block.data.text || ""}
          onChange={(e) => onUpdate({ ...block.data, text: e.target.value })}
          disabled={!isEditable}
          className="w-full h-9 rounded bg-neutral-600 border border-neutral-500 px-2 text-white text-sm disabled:opacity-50"
          placeholder="Promo text"
        />
      )}

      {block.type === "text_block" && (
        <textarea
          value={block.data.content || ""}
          onChange={(e) => onUpdate({ ...block.data, content: e.target.value })}
          disabled={!isEditable}
          className="w-full h-24 rounded bg-neutral-600 border border-neutral-500 px-2 py-1 text-white text-sm disabled:opacity-50 resize-none"
          placeholder="Text content..."
        />
      )}

      {block.type === "cta_button" && (
        <div className="flex gap-2">
          <input
            type="text"
            value={block.data.text || ""}
            onChange={(e) => onUpdate({ ...block.data, text: e.target.value })}
            disabled={!isEditable}
            className="flex-1 h-9 rounded bg-neutral-600 border border-neutral-500 px-2 text-white text-sm disabled:opacity-50"
            placeholder="Button text"
          />
          <input
            type="text"
            value={block.data.url || ""}
            onChange={(e) => onUpdate({ ...block.data, url: e.target.value })}
            disabled={!isEditable}
            className="flex-1 h-9 rounded bg-neutral-600 border border-neutral-500 px-2 text-white text-sm disabled:opacity-50"
            placeholder="Button URL"
          />
        </div>
      )}

      {block.type === "divider" && (
        <div className="text-neutral-500 text-sm">Horizontal line separator</div>
      )}

      {block.type === "product_grid" && (
        <div className="text-neutral-500 text-sm">
          Product grid (configure products in JSON for now)
        </div>
      )}
    </div>
  );
}

// Default block data
function getDefaultBlockData(type: string): Record<string, any> {
  switch (type) {
    case "hero":
      return { headline: "", subheadline: "", backgroundColor: "#dc2626" };
    case "promo_banner":
      return { text: "", backgroundColor: "#1e40af" };
    case "text_block":
      return { content: "", alignment: "left" };
    case "cta_button":
      return { text: "Shop Now", url: "/", style: "primary", alignment: "center" };
    case "divider":
      return { style: "solid" };
    case "product_grid":
      return { title: "", products: [], columns: 2 };
    default:
      return {};
  }
}
