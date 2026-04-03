"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  subject: string;
  previewText?: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
  isTest?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-neutral-600",
  scheduled: "bg-blue-600",
  sending: "bg-yellow-600",
  paused: "bg-orange-600",
  sent: "bg-green-600",
  cancelled: "bg-red-600",
};

const TYPE_LABELS: Record<string, string> = {
  tire_promo: "Tire Promo",
  wheel_promo: "Wheel Promo",
  package_promo: "Package Promo",
  newsletter: "Newsletter",
  announcement: "Announcement",
  seasonal: "Seasonal",
  clearance: "Clearance",
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPercent(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [includeTest, setIncludeTest] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create campaign modal
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    campaignType: "newsletter",
    subject: "",
    previewText: "",
  });

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (includeTest) params.set("includeTest", "true");
      params.set("limit", "100");

      const res = await fetch(`/api/admin/email-campaigns?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to fetch campaigns");

      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, includeTest]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("create");
    setMessage(null);

    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newCampaign,
          contentJson: { blocks: [] },
          audienceRulesJson: {},
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");

      setMessage({ type: "success", text: `Campaign "${newCampaign.name}" created` });
      setShowCreate(false);
      setNewCampaign({ name: "", campaignType: "newsletter", subject: "", previewText: "" });
      fetchCampaigns();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}/${action}`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action}`);

      setMessage({ type: "success", text: `Campaign ${action} successful` });
      fetchCampaigns();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    await handleAction(id, "duplicate");
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return;

    setActionLoading(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/email-campaigns/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");

      setMessage({ type: "success", text: `Campaign "${name}" deleted` });
      fetchCampaigns();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
          <p className="text-neutral-400 mt-1">Create and manage marketing email campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          + New Campaign
        </button>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6 bg-neutral-800 rounded-lg p-4">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="paused">Paused</option>
            <option value="sent">Sent</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
          >
            <option value="">All Types</option>
            <option value="newsletter">Newsletter</option>
            <option value="tire_promo">Tire Promo</option>
            <option value="wheel_promo">Wheel Promo</option>
            <option value="package_promo">Package Promo</option>
            <option value="announcement">Announcement</option>
            <option value="seasonal">Seasonal</option>
            <option value="clearance">Clearance</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="rounded bg-neutral-700 border-neutral-600"
            />
            Include Test Campaigns
          </label>
        </div>
      </div>

      {/* Loading/Error */}
      {loading && (
        <div className="text-center py-12 text-neutral-400">Loading campaigns...</div>
      )}
      {error && (
        <div className="text-center py-12 text-red-400">{error}</div>
      )}

      {/* Campaign List */}
      {!loading && !error && (
        <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Campaign</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Recipients</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Sent</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Opened</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Clicked</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Date</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-neutral-500">
                    No campaigns found. Create your first campaign!
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="border-b border-neutral-700/50 hover:bg-neutral-700/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/email-campaigns/${campaign.id}`}
                        className="block hover:text-red-400 transition-colors"
                      >
                        <div className="font-medium text-white flex items-center gap-2">
                          {campaign.name}
                          {campaign.isTest && (
                            <span className="text-xs bg-yellow-600/50 text-yellow-300 px-1.5 py-0.5 rounded">
                              TEST
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-neutral-400 truncate max-w-xs">
                          {campaign.subject}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {TYPE_LABELS[campaign.campaignType] || campaign.campaignType}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded text-xs font-medium text-white ${
                          STATUS_COLORS[campaign.status] || "bg-neutral-600"
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-300">
                      {campaign.totalRecipients.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-300">
                      {campaign.sentCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-neutral-300">{campaign.openedCount.toLocaleString()}</span>
                      <span className="text-neutral-500 text-sm ml-1">
                        ({formatPercent(campaign.openedCount, campaign.deliveredCount)})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-neutral-300">{campaign.clickedCount.toLocaleString()}</span>
                      <span className="text-neutral-500 text-sm ml-1">
                        ({formatPercent(campaign.clickedCount, campaign.deliveredCount)})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">
                      {campaign.sentAt
                        ? formatDate(campaign.sentAt)
                        : campaign.scheduledFor
                        ? `Scheduled: ${formatDate(campaign.scheduledFor)}`
                        : formatDate(campaign.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/email-campaigns/${campaign.id}`}
                          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                          title="Edit"
                        >
                          ✏️
                        </Link>
                        <Link
                          href={`/admin/email-campaigns/${campaign.id}/stats`}
                          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                          title="Stats"
                        >
                          📊
                        </Link>
                        <button
                          onClick={() => handleDuplicate(campaign.id)}
                          disabled={actionLoading === campaign.id}
                          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
                          title="Duplicate"
                        >
                          📋
                        </button>
                        {campaign.status === "draft" && (
                          <button
                            onClick={() => handleDelete(campaign.id, campaign.name)}
                            disabled={actionLoading === campaign.id}
                            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-lg w-full p-6 border border-neutral-700">
            <h2 className="text-xl font-bold text-white mb-4">Create Campaign</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                  placeholder="e.g., Summer Tire Sale 2026"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Campaign Type *
                </label>
                <select
                  value={newCampaign.campaignType}
                  onChange={(e) => setNewCampaign({ ...newCampaign, campaignType: e.target.value })}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                >
                  <option value="newsletter">Newsletter</option>
                  <option value="tire_promo">Tire Promo</option>
                  <option value="wheel_promo">Wheel Promo</option>
                  <option value="package_promo">Package Promo</option>
                  <option value="announcement">Announcement</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="clearance">Clearance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                  placeholder="e.g., 🔥 Up to 30% Off Summer Tires"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">
                  Preview Text
                </label>
                <input
                  type="text"
                  value={newCampaign.previewText}
                  onChange={(e) => setNewCampaign({ ...newCampaign, previewText: e.target.value })}
                  className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
                  placeholder="Shown in email client preview"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 h-10 rounded-lg bg-neutral-700 text-white font-medium hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "create"}
                  className="flex-1 h-10 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "create" ? "Creating..." : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
