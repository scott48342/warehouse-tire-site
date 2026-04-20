"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface Build {
  id: number;
  submissionId: string;
  status: string;
  customer: {
    email: string | null;
    name: string | null;
    orderId: string | null;
    instagram: string | null;
  };
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    type: string | null;
  };
  build: {
    liftType: string | null;
    liftInches: number | null;
    liftBrand: string | null;
  };
  products: {
    wheelBrand: string | null;
    wheelModel: string | null;
    tireBrand: string | null;
    tireModel: string | null;
    tireSize: string | null;
  };
  notes: string | null;
  moderatorNotes: string | null;
  isFeatured: boolean;
  images: {
    id: number;
    url: string;
    thumbnail: string | null;
    angle: string | null;
    isPrimary: boolean;
  }[];
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_TABS = [
  { key: "pending", label: "Pending", emoji: "⏳" },
  { key: "approved", label: "Approved", emoji: "✅" },
  { key: "rejected", label: "Rejected", emoji: "❌" },
  { key: "flagged", label: "Flagged", emoji: "🚩" },
];

export default function AdminBuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  // Fetch builds
  const fetchBuilds = useCallback(async (page = 1) => {
    if (!apiKey) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/builds?status=${status}&page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      
      const data = await res.json();
      setBuilds(data.builds || []);
      setPagination(data.pagination);
      setAuthenticated(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, status]);

  useEffect(() => {
    if (apiKey) {
      fetchBuilds();
    }
  }, [apiKey, status, fetchBuilds]);

  // Handle actions
  const handleAction = async (buildId: number, action: "approve" | "reject" | "flag" | "feature") => {
    setActionLoading(true);
    
    try {
      const payload: Record<string, unknown> = { id: buildId };
      
      if (action === "approve") payload.status = "approved";
      else if (action === "reject") payload.status = "rejected";
      else if (action === "flag") payload.status = "flagged";
      else if (action === "feature") {
        const build = builds.find((b) => b.id === buildId);
        payload.isFeatured = !build?.isFeatured;
      }
      
      await fetch("/api/admin/builds", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      
      // Refresh
      await fetchBuilds(pagination?.page || 1);
      setSelectedBuild(null);
      
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Auth screen
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">Admin Login</h1>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter admin API key"
            className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm mb-4"
            onKeyDown={(e) => e.key === "Enter" && fetchBuilds()}
          />
          <button
            onClick={() => fetchBuilds()}
            className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-800"
          >
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Build Submissions</h1>
            <p className="text-sm text-neutral-600">
              Review and moderate customer build submissions
            </p>
          </div>
          <div className="text-sm text-neutral-500">
            {pagination?.total || 0} total
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
                status === tab.key
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Build List */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading...</div>
        ) : builds.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            No {status} submissions
          </div>
        ) : (
          <div className="grid gap-4">
            {builds.map((build) => (
              <div
                key={build.id}
                className="bg-white rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedBuild(build)}
              >
                <div className="flex gap-4">
                  {/* Primary Image */}
                  <div className="relative w-32 h-24 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                    {build.images[0] && (
                      <Image
                        src={build.images[0].thumbnail || build.images[0].url}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                    {build.images.length > 1 && (
                      <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 rounded">
                        +{build.images.length - 1}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-neutral-900">
                          {build.vehicle.year} {build.vehicle.make} {build.vehicle.model}
                        </h3>
                        <p className="text-sm text-neutral-600">
                          {build.products.wheelBrand} {build.products.wheelModel}
                          {build.build.liftType && build.build.liftType !== "stock" && (
                            <span className="text-amber-600 ml-2">
                              • {build.build.liftType} {build.build.liftInches && `${build.build.liftInches}"`}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {build.isFeatured && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                            ⭐ Featured
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          build.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          build.status === "approved" ? "bg-green-100 text-green-700" :
                          build.status === "rejected" ? "bg-red-100 text-red-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {build.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                      {build.customer.name && <span>👤 {build.customer.name}</span>}
                      {build.customer.instagram && (
                        <span>📷 {build.customer.instagram}</span>
                      )}
                      <span>📅 {new Date(build.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {build.status === "pending" && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleAction(build.id, "approve")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleAction(build.id, "reject")}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchBuilds(p)}
                className={`w-8 h-8 rounded-lg text-sm ${
                  p === pagination.page
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedBuild && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedBuild(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900">
                {selectedBuild.vehicle.year} {selectedBuild.vehicle.make} {selectedBuild.vehicle.model}
              </h2>
              <button
                onClick={() => setSelectedBuild(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Images */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {selectedBuild.images.map((img) => (
                  <div key={img.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-100">
                    <Image src={img.url} alt="" fill className="object-cover" />
                    {img.isPrimary && (
                      <div className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded">
                        PRIMARY
                      </div>
                    )}
                    {img.angle && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                        {img.angle}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Details Grid */}
              <div className="grid sm:grid-cols-2 gap-6 mb-6">
                {/* Vehicle */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">Vehicle</h3>
                  <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-1">
                    <p><span className="text-neutral-500">Year:</span> {selectedBuild.vehicle.year || "—"}</p>
                    <p><span className="text-neutral-500">Make:</span> {selectedBuild.vehicle.make}</p>
                    <p><span className="text-neutral-500">Model:</span> {selectedBuild.vehicle.model}</p>
                    <p><span className="text-neutral-500">Trim:</span> {selectedBuild.vehicle.trim || "—"}</p>
                    <p><span className="text-neutral-500">Type:</span> {selectedBuild.vehicle.type || "—"}</p>
                  </div>
                </div>

                {/* Build */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">Build</h3>
                  <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-1">
                    <p><span className="text-neutral-500">Lift Type:</span> {selectedBuild.build.liftType || "stock"}</p>
                    <p><span className="text-neutral-500">Lift Height:</span> {selectedBuild.build.liftInches ? `${selectedBuild.build.liftInches}"` : "—"}</p>
                    <p><span className="text-neutral-500">Lift Brand:</span> {selectedBuild.build.liftBrand || "—"}</p>
                  </div>
                </div>

                {/* Wheels */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">Wheels</h3>
                  <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-1">
                    <p><span className="text-neutral-500">Brand:</span> {selectedBuild.products.wheelBrand || "—"}</p>
                    <p><span className="text-neutral-500">Model:</span> {selectedBuild.products.wheelModel || "—"}</p>
                  </div>
                </div>

                {/* Tires */}
                <div>
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">Tires</h3>
                  <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-1">
                    <p><span className="text-neutral-500">Brand:</span> {selectedBuild.products.tireBrand || "—"}</p>
                    <p><span className="text-neutral-500">Model:</span> {selectedBuild.products.tireModel || "—"}</p>
                    <p><span className="text-neutral-500">Size:</span> {selectedBuild.products.tireSize || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedBuild.notes && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-neutral-700 mb-2">Customer Notes</h3>
                  <div className="bg-neutral-50 rounded-xl p-4 text-sm text-neutral-700">
                    {selectedBuild.notes}
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-neutral-700 mb-2">Customer</h3>
                <div className="bg-neutral-50 rounded-xl p-4 text-sm space-y-1">
                  <p><span className="text-neutral-500">Name:</span> {selectedBuild.customer.name || "—"}</p>
                  <p><span className="text-neutral-500">Email:</span> {selectedBuild.customer.email || "—"}</p>
                  <p><span className="text-neutral-500">Instagram:</span> {selectedBuild.customer.instagram || "—"}</p>
                  <p><span className="text-neutral-500">Order ID:</span> {selectedBuild.customer.orderId || "—"}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-neutral-200">
                {selectedBuild.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleAction(selectedBuild.id, "approve")}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleAction(selectedBuild.id, "reject")}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                    >
                      ✕ Reject
                    </button>
                    <button
                      onClick={() => handleAction(selectedBuild.id, "flag")}
                      disabled={actionLoading}
                      className="px-4 py-2 rounded-xl bg-orange-100 text-orange-700 text-sm font-bold hover:bg-orange-200 disabled:opacity-50"
                    >
                      🚩 Flag
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleAction(selectedBuild.id, "feature")}
                  disabled={actionLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 ${
                    selectedBuild.isFeatured
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {selectedBuild.isFeatured ? "★ Unfeature" : "☆ Feature"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
