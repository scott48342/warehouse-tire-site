"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ScoreSlider, ScoreComparison } from "./ScoreSlider";

// ============================================================================
// Types
// ============================================================================

type PageType = "srp" | "pdp";

interface Analysis {
  id: string;
  pageType: PageType;
  ourUrl: string;
  competitorName: string;
  competitorUrl: string;
  vehicleContext?: { year?: string; make?: string; model?: string; trim?: string };
  productContext?: { sku?: string; brand?: string; productName?: string };
  // SRP scores
  srpImageQualityScore: number | null;
  srpPricingClarityScore: number | null;
  srpTrustSignalScore: number | null;
  srpFilterUsabilityScore: number | null;
  srpMerchandisingScore: number | null;
  ourSrpImageQualityScore: number | null;
  ourSrpPricingClarityScore: number | null;
  ourSrpTrustSignalScore: number | null;
  ourSrpFilterUsabilityScore: number | null;
  ourSrpMerchandisingScore: number | null;
  // PDP scores
  pdpAboveFoldClarityScore: number | null;
  pdpImageExperienceScore: number | null;
  pdpProductInfoScore: number | null;
  pdpTrustLayerScore: number | null;
  pdpConversionDriverScore: number | null;
  pdpCtaStrengthScore: number | null;
  ourPdpAboveFoldClarityScore: number | null;
  ourPdpImageExperienceScore: number | null;
  ourPdpProductInfoScore: number | null;
  ourPdpTrustLayerScore: number | null;
  ourPdpConversionDriverScore: number | null;
  ourPdpCtaStrengthScore: number | null;
  // Notes
  notes: string | null;
  strengths: string | null;
  weaknesses: string | null;
  opportunities: string | null;
  // Meta
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalAnalyses: number;
  srpCount: number;
  pdpCount: number;
  competitorCounts: { name: string; count: number }[];
}

interface FormData {
  pageType: PageType;
  ourUrl: string;
  competitorName: string;
  competitorUrl: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  productSku?: string;
  productBrand?: string;
  // SRP scores (competitor)
  srpImageQuality: number | null;
  srpPricingClarity: number | null;
  srpTrustSignal: number | null;
  srpFilterUsability: number | null;
  srpMerchandising: number | null;
  // SRP scores (ours)
  ourSrpImageQuality: number | null;
  ourSrpPricingClarity: number | null;
  ourSrpTrustSignal: number | null;
  ourSrpFilterUsability: number | null;
  ourSrpMerchandising: number | null;
  // PDP scores (competitor)
  pdpAboveFoldClarity: number | null;
  pdpImageExperience: number | null;
  pdpProductInfo: number | null;
  pdpTrustLayer: number | null;
  pdpConversionDriver: number | null;
  pdpCtaStrength: number | null;
  // PDP scores (ours)
  ourPdpAboveFoldClarity: number | null;
  ourPdpImageExperience: number | null;
  ourPdpProductInfo: number | null;
  ourPdpTrustLayer: number | null;
  ourPdpConversionDriver: number | null;
  ourPdpCtaStrength: number | null;
  // Notes
  notes: string;
  strengths: string;
  weaknesses: string;
  opportunities: string;
}

const defaultFormData: FormData = {
  pageType: "srp",
  ourUrl: "",
  competitorName: "",
  competitorUrl: "",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  productSku: "",
  productBrand: "",
  srpImageQuality: null,
  srpPricingClarity: null,
  srpTrustSignal: null,
  srpFilterUsability: null,
  srpMerchandising: null,
  ourSrpImageQuality: null,
  ourSrpPricingClarity: null,
  ourSrpTrustSignal: null,
  ourSrpFilterUsability: null,
  ourSrpMerchandising: null,
  pdpAboveFoldClarity: null,
  pdpImageExperience: null,
  pdpProductInfo: null,
  pdpTrustLayer: null,
  pdpConversionDriver: null,
  pdpCtaStrength: null,
  ourPdpAboveFoldClarity: null,
  ourPdpImageExperience: null,
  ourPdpProductInfo: null,
  ourPdpTrustLayer: null,
  ourPdpConversionDriver: null,
  ourPdpCtaStrength: null,
  notes: "",
  strengths: "",
  weaknesses: "",
  opportunities: "",
};

// ============================================================================
// Helpers
// ============================================================================

function calculateAvg(scores: (number | null)[]): number {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-green-400";
  if (score >= 6) return "text-blue-400";
  if (score >= 4) return "text-yellow-400";
  return "text-red-400";
}

// ============================================================================
// Component
// ============================================================================

export default function CompetitorAnalysisPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // View state
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<PageType | "">("");
  const [filterCompetitor, setFilterCompetitor] = useState("");
  
  // Form state
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Competitor list for dropdown
  const [competitors, setCompetitors] = useState<string[]>([]);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load analyses
      const params = new URLSearchParams();
      if (filterType) params.set("pageType", filterType);
      if (filterCompetitor) params.set("competitor", filterCompetitor);
      
      const [analysesRes, statsRes, competitorsRes] = await Promise.all([
        fetch(`/api/admin/competitor-analysis?action=list&${params}`),
        fetch("/api/admin/competitor-analysis?action=stats"),
        fetch("/api/admin/competitor-analysis?action=competitors"),
      ]);

      if (analysesRes.ok) {
        const data = await analysesRes.json();
        setAnalyses(data.analyses);
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      
      if (competitorsRes.ok) {
        const data = await competitorsRes.json();
        setCompetitors(data.competitors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCompetitor]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save analysis
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const payload: any = {
        pageType: formData.pageType,
        ourUrl: formData.ourUrl,
        competitorName: formData.competitorName,
        competitorUrl: formData.competitorUrl,
        notes: formData.notes || undefined,
        strengths: formData.strengths || undefined,
        weaknesses: formData.weaknesses || undefined,
        opportunities: formData.opportunities || undefined,
      };

      // Add vehicle context if provided
      if (formData.vehicleYear || formData.vehicleMake || formData.vehicleModel) {
        payload.vehicleContext = {
          year: formData.vehicleYear || undefined,
          make: formData.vehicleMake || undefined,
          model: formData.vehicleModel || undefined,
        };
      }

      // Add product context if provided
      if (formData.productSku || formData.productBrand) {
        payload.productContext = {
          sku: formData.productSku || undefined,
          brand: formData.productBrand || undefined,
        };
      }

      // Add scores based on page type
      if (formData.pageType === "srp") {
        payload.competitorScores = {
          imageQuality: formData.srpImageQuality,
          pricingClarity: formData.srpPricingClarity,
          trustSignal: formData.srpTrustSignal,
          filterUsability: formData.srpFilterUsability,
          merchandising: formData.srpMerchandising,
        };
        payload.ourScores = {
          imageQuality: formData.ourSrpImageQuality,
          pricingClarity: formData.ourSrpPricingClarity,
          trustSignal: formData.ourSrpTrustSignal,
          filterUsability: formData.ourSrpFilterUsability,
          merchandising: formData.ourSrpMerchandising,
        };
      } else {
        payload.competitorScores = {
          aboveFoldClarity: formData.pdpAboveFoldClarity,
          imageExperience: formData.pdpImageExperience,
          productInfo: formData.pdpProductInfo,
          trustLayer: formData.pdpTrustLayer,
          conversionDriver: formData.pdpConversionDriver,
          ctaStrength: formData.pdpCtaStrength,
        };
        payload.ourScores = {
          aboveFoldClarity: formData.ourPdpAboveFoldClarity,
          imageExperience: formData.ourPdpImageExperience,
          productInfo: formData.ourPdpProductInfo,
          trustLayer: formData.ourPdpTrustLayer,
          conversionDriver: formData.ourPdpConversionDriver,
          ctaStrength: formData.ourPdpCtaStrength,
        };
      }

      const url = "/api/admin/competitor-analysis";
      const method = editingId ? "PATCH" : "POST";
      if (editingId) payload.id = editingId;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      // Reset and reload
      setFormData(defaultFormData);
      setEditingId(null);
      setView("list");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Load analysis for editing
  const handleEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/competitor-analysis?action=get&id=${id}`);
      if (!res.ok) throw new Error("Failed to load");
      
      const analysis: Analysis = await res.json();
      
      setFormData({
        pageType: analysis.pageType,
        ourUrl: analysis.ourUrl,
        competitorName: analysis.competitorName,
        competitorUrl: analysis.competitorUrl,
        vehicleYear: analysis.vehicleContext?.year || "",
        vehicleMake: analysis.vehicleContext?.make || "",
        vehicleModel: analysis.vehicleContext?.model || "",
        productSku: analysis.productContext?.sku || "",
        productBrand: analysis.productContext?.brand || "",
        // SRP scores
        srpImageQuality: analysis.srpImageQualityScore,
        srpPricingClarity: analysis.srpPricingClarityScore,
        srpTrustSignal: analysis.srpTrustSignalScore,
        srpFilterUsability: analysis.srpFilterUsabilityScore,
        srpMerchandising: analysis.srpMerchandisingScore,
        ourSrpImageQuality: analysis.ourSrpImageQualityScore,
        ourSrpPricingClarity: analysis.ourSrpPricingClarityScore,
        ourSrpTrustSignal: analysis.ourSrpTrustSignalScore,
        ourSrpFilterUsability: analysis.ourSrpFilterUsabilityScore,
        ourSrpMerchandising: analysis.ourSrpMerchandisingScore,
        // PDP scores
        pdpAboveFoldClarity: analysis.pdpAboveFoldClarityScore,
        pdpImageExperience: analysis.pdpImageExperienceScore,
        pdpProductInfo: analysis.pdpProductInfoScore,
        pdpTrustLayer: analysis.pdpTrustLayerScore,
        pdpConversionDriver: analysis.pdpConversionDriverScore,
        pdpCtaStrength: analysis.pdpCtaStrengthScore,
        ourPdpAboveFoldClarity: analysis.ourPdpAboveFoldClarityScore,
        ourPdpImageExperience: analysis.ourPdpImageExperienceScore,
        ourPdpProductInfo: analysis.ourPdpProductInfoScore,
        ourPdpTrustLayer: analysis.ourPdpTrustLayerScore,
        ourPdpConversionDriver: analysis.ourPdpConversionDriverScore,
        ourPdpCtaStrength: analysis.ourPdpCtaStrengthScore,
        // Notes
        notes: analysis.notes || "",
        strengths: analysis.strengths || "",
        weaknesses: analysis.weaknesses || "",
        opportunities: analysis.opportunities || "",
      });
      
      setEditingId(id);
      setView("form");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  };

  // Archive analysis
  const handleArchive = async (id: string) => {
    if (!confirm("Archive this analysis?")) return;
    
    try {
      const res = await fetch(`/api/admin/competitor-analysis?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to archive");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive");
    }
  };

  // Calculate analysis averages
  const getAnalysisAvgs = (a: Analysis) => {
    if (a.pageType === "srp") {
      const ourScores = [a.ourSrpImageQualityScore, a.ourSrpPricingClarityScore, a.ourSrpTrustSignalScore, a.ourSrpFilterUsabilityScore, a.ourSrpMerchandisingScore];
      const compScores = [a.srpImageQualityScore, a.srpPricingClarityScore, a.srpTrustSignalScore, a.srpFilterUsabilityScore, a.srpMerchandisingScore];
      return { ourAvg: calculateAvg(ourScores), compAvg: calculateAvg(compScores) };
    } else {
      const ourScores = [a.ourPdpAboveFoldClarityScore, a.ourPdpImageExperienceScore, a.ourPdpProductInfoScore, a.ourPdpTrustLayerScore, a.ourPdpConversionDriverScore, a.ourPdpCtaStrengthScore];
      const compScores = [a.pdpAboveFoldClarityScore, a.pdpImageExperienceScore, a.pdpProductInfoScore, a.pdpTrustLayerScore, a.pdpConversionDriverScore, a.pdpCtaStrengthScore];
      return { ourAvg: calculateAvg(ourScores), compAvg: calculateAvg(compScores) };
    }
  };

  // Update form field
  const updateForm = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🎯 Competitor Analysis</h1>
          <p className="text-neutral-400 mt-1">Compare SRP & PDP pages against competitors</p>
        </div>
        {view === "list" && (
          <button
            onClick={() => { setFormData(defaultFormData); setEditingId(null); setView("form"); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500"
          >
            + New Comparison
          </button>
        )}
        {view !== "list" && (
          <button
            onClick={() => { setView("list"); setFormData(defaultFormData); setEditingId(null); }}
            className="px-4 py-2 bg-neutral-700 text-white rounded-lg text-sm hover:bg-neutral-600"
          >
            ← Back to List
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      {view === "list" && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
            <div className="text-2xl font-bold text-white">{stats.totalAnalyses}</div>
            <div className="text-sm text-neutral-400">Total Comparisons</div>
          </div>
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.srpCount}</div>
            <div className="text-sm text-neutral-400">SRP Analyses</div>
          </div>
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
            <div className="text-2xl font-bold text-green-400">{stats.pdpCount}</div>
            <div className="text-sm text-neutral-400">PDP Analyses</div>
          </div>
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.competitorCounts.length}</div>
            <div className="text-sm text-neutral-400">Competitors Tracked</div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LIST VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {view === "list" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 bg-neutral-800 rounded-lg border border-neutral-700 p-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-400">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as PageType | "")}
                className="bg-neutral-700 border border-neutral-600 rounded px-3 py-1.5 text-sm text-white"
              >
                <option value="">All</option>
                <option value="srp">SRP</option>
                <option value="pdp">PDP</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-neutral-400">Competitor:</label>
              <select
                value={filterCompetitor}
                onChange={(e) => setFilterCompetitor(e.target.value)}
                className="bg-neutral-700 border border-neutral-600 rounded px-3 py-1.5 text-sm text-white min-w-[150px]"
              >
                <option value="">All</option>
                {competitors.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadData}
              className="ml-auto px-3 py-1.5 bg-neutral-700 text-white rounded text-sm hover:bg-neutral-600"
            >
              Refresh
            </button>
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-12 text-neutral-500">Loading...</div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              No analyses yet. Click "New Comparison" to start.
            </div>
          ) : (
            <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">Competitor</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-400">Our URL</th>
                    <th className="px-4 py-3 text-center font-medium text-neutral-400">Us</th>
                    <th className="px-4 py-3 text-center font-medium text-neutral-400">Them</th>
                    <th className="px-4 py-3 text-center font-medium text-neutral-400">Diff</th>
                    <th className="px-4 py-3 text-right font-medium text-neutral-400">Updated</th>
                    <th className="px-4 py-3 text-right font-medium text-neutral-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map((a) => {
                    const { ourAvg, compAvg } = getAnalysisAvgs(a);
                    const diff = Math.round((ourAvg - compAvg) * 10) / 10;
                    return (
                      <tr key={a.id} className="border-t border-neutral-700 hover:bg-neutral-700/50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            a.pageType === "srp" ? "bg-blue-900/50 text-blue-400" : "bg-green-900/50 text-green-400"
                          }`}>
                            {a.pageType.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-medium">{a.competitorName}</td>
                        <td className="px-4 py-3 text-neutral-400 truncate max-w-[200px]" title={a.ourUrl}>
                          {a.ourUrl}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${getScoreColor(ourAvg)}`}>{ourAvg || "-"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${getScoreColor(compAvg)}`}>{compAvg || "-"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-neutral-400"}`}>
                            {diff > 0 ? `+${diff}` : diff || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-500 text-xs">
                          {new Date(a.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleEdit(a.id)}
                            className="px-2 py-1 text-blue-400 hover:text-blue-300 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchive(a.id)}
                            className="px-2 py-1 text-red-400 hover:text-red-300 text-xs ml-2"
                          >
                            Archive
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* FORM VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {view === "form" && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4">📋 Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Page Type *</label>
                <select
                  value={formData.pageType}
                  onChange={(e) => updateForm("pageType", e.target.value as PageType)}
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                >
                  <option value="srp">SRP (Search Results Page)</option>
                  <option value="pdp">PDP (Product Detail Page)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Competitor Name *</label>
                <input
                  type="text"
                  value={formData.competitorName}
                  onChange={(e) => updateForm("competitorName", e.target.value)}
                  placeholder="e.g., TireRack, Discount Tire"
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Our URL *</label>
                <input
                  type="url"
                  value={formData.ourUrl}
                  onChange={(e) => updateForm("ourUrl", e.target.value)}
                  placeholder="https://warehousetiredirect.com/..."
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Competitor URL *</label>
                <input
                  type="url"
                  value={formData.competitorUrl}
                  onChange={(e) => updateForm("competitorUrl", e.target.value)}
                  placeholder="https://competitor.com/..."
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Context (Optional) */}
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4">🚗 Context (Optional)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Year</label>
                <input
                  type="text"
                  value={formData.vehicleYear}
                  onChange={(e) => updateForm("vehicleYear", e.target.value)}
                  placeholder="2024"
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Make</label>
                <input
                  type="text"
                  value={formData.vehicleMake}
                  onChange={(e) => updateForm("vehicleMake", e.target.value)}
                  placeholder="Ford"
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Model</label>
                <input
                  type="text"
                  value={formData.vehicleModel}
                  onChange={(e) => updateForm("vehicleModel", e.target.value)}
                  placeholder="F-150"
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Product SKU</label>
                <input
                  type="text"
                  value={formData.productSku}
                  onChange={(e) => updateForm("productSku", e.target.value)}
                  placeholder="SKU123"
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Scoring Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Our Scores */}
            <div className="bg-neutral-800 rounded-lg border border-green-700/50 p-6">
              <h2 className="text-lg font-bold text-green-400 mb-4">✅ Our Page Scores</h2>
              <div className="space-y-6">
                {formData.pageType === "srp" ? (
                  <>
                    <ScoreSlider label="Image Quality" value={formData.ourSrpImageQuality} onChange={(v) => updateForm("ourSrpImageQuality", v)} />
                    <ScoreSlider label="Pricing Clarity" value={formData.ourSrpPricingClarity} onChange={(v) => updateForm("ourSrpPricingClarity", v)} />
                    <ScoreSlider label="Trust Signals" value={formData.ourSrpTrustSignal} onChange={(v) => updateForm("ourSrpTrustSignal", v)} />
                    <ScoreSlider label="Filter Usability" value={formData.ourSrpFilterUsability} onChange={(v) => updateForm("ourSrpFilterUsability", v)} />
                    <ScoreSlider label="Merchandising" value={formData.ourSrpMerchandising} onChange={(v) => updateForm("ourSrpMerchandising", v)} />
                  </>
                ) : (
                  <>
                    <ScoreSlider label="Above-Fold Clarity" value={formData.ourPdpAboveFoldClarity} onChange={(v) => updateForm("ourPdpAboveFoldClarity", v)} />
                    <ScoreSlider label="Image Experience" value={formData.ourPdpImageExperience} onChange={(v) => updateForm("ourPdpImageExperience", v)} />
                    <ScoreSlider label="Product Info" value={formData.ourPdpProductInfo} onChange={(v) => updateForm("ourPdpProductInfo", v)} />
                    <ScoreSlider label="Trust Layer" value={formData.ourPdpTrustLayer} onChange={(v) => updateForm("ourPdpTrustLayer", v)} />
                    <ScoreSlider label="Conversion Drivers" value={formData.ourPdpConversionDriver} onChange={(v) => updateForm("ourPdpConversionDriver", v)} />
                    <ScoreSlider label="CTA Strength" value={formData.ourPdpCtaStrength} onChange={(v) => updateForm("ourPdpCtaStrength", v)} />
                  </>
                )}
              </div>
            </div>

            {/* Competitor Scores */}
            <div className="bg-neutral-800 rounded-lg border border-red-700/50 p-6">
              <h2 className="text-lg font-bold text-red-400 mb-4">🎯 Competitor Scores</h2>
              <div className="space-y-6">
                {formData.pageType === "srp" ? (
                  <>
                    <ScoreSlider label="Image Quality" value={formData.srpImageQuality} onChange={(v) => updateForm("srpImageQuality", v)} />
                    <ScoreSlider label="Pricing Clarity" value={formData.srpPricingClarity} onChange={(v) => updateForm("srpPricingClarity", v)} />
                    <ScoreSlider label="Trust Signals" value={formData.srpTrustSignal} onChange={(v) => updateForm("srpTrustSignal", v)} />
                    <ScoreSlider label="Filter Usability" value={formData.srpFilterUsability} onChange={(v) => updateForm("srpFilterUsability", v)} />
                    <ScoreSlider label="Merchandising" value={formData.srpMerchandising} onChange={(v) => updateForm("srpMerchandising", v)} />
                  </>
                ) : (
                  <>
                    <ScoreSlider label="Above-Fold Clarity" value={formData.pdpAboveFoldClarity} onChange={(v) => updateForm("pdpAboveFoldClarity", v)} />
                    <ScoreSlider label="Image Experience" value={formData.pdpImageExperience} onChange={(v) => updateForm("pdpImageExperience", v)} />
                    <ScoreSlider label="Product Info" value={formData.pdpProductInfo} onChange={(v) => updateForm("pdpProductInfo", v)} />
                    <ScoreSlider label="Trust Layer" value={formData.pdpTrustLayer} onChange={(v) => updateForm("pdpTrustLayer", v)} />
                    <ScoreSlider label="Conversion Drivers" value={formData.pdpConversionDriver} onChange={(v) => updateForm("pdpConversionDriver", v)} />
                    <ScoreSlider label="CTA Strength" value={formData.pdpCtaStrength} onChange={(v) => updateForm("pdpCtaStrength", v)} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4">📝 Analysis Notes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-400 mb-1">💪 Strengths (Ours)</label>
                <textarea
                  value={formData.strengths}
                  onChange={(e) => updateForm("strengths", e.target.value)}
                  rows={3}
                  placeholder="What we do better..."
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-red-400 mb-1">⚠️ Weaknesses (Ours)</label>
                <textarea
                  value={formData.weaknesses}
                  onChange={(e) => updateForm("weaknesses", e.target.value)}
                  rows={3}
                  placeholder="Where competitor beats us..."
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-yellow-400 mb-1">💡 Opportunities</label>
                <textarea
                  value={formData.opportunities}
                  onChange={(e) => updateForm("opportunities", e.target.value)}
                  rows={3}
                  placeholder="What we could improve..."
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">📋 General Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  rows={3}
                  placeholder="Additional observations..."
                  className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => { setView("list"); setFormData(defaultFormData); setEditingId(null); }}
              className="px-6 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.ourUrl || !formData.competitorName || !formData.competitorUrl}
              className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : editingId ? "Update Analysis" : "Save Analysis"}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-6 border-t border-neutral-700 flex gap-4">
        <Link href="/admin" className="text-neutral-400 hover:text-white text-sm">
          ← Dashboard
        </Link>
      </div>
    </div>
  );
}
