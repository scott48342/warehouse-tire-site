"use client";

import { useState, useEffect } from "react";

interface WTDIssue {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  evidence: {
    wtdValue: any;
    wheelProsValue: any;
    affectedWheels: number;
    examples: string[];
  };
}

interface VehicleSummary {
  vehicle: { year: number; make: string; model: string; trim?: string };
  wtdSpecs: {
    boltPattern: string | null;
    centerBoreMm: number | null;
    offsetRange: string | null;
    widths: number[];
    diameters: number[];
  };
  totalWheelsQueried: number;
  cleanMatches: number;
  aggressiveAftermarket: number;
  unsafeProducts: number;
  manualReviewNeeded: number;
  wtdIssues: WTDIssue[];
}

interface AuditSummary {
  auditDate: string;
  summary: {
    totalWheelsAudited: number;
    totalCleanMatches: number;
    totalAggressiveAftermarket: number;
    totalUnsafe: number;
    totalManualReview: number;
    topWTDIssues: Array<{ vehicle: string; issue: WTDIssue }>;
  };
  vehicles: VehicleSummary[];
}

const severityColors = {
  high: "bg-red-100 text-red-800 border-red-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-blue-100 text-blue-800 border-blue-300",
};

const issueTypeLabels: Record<string, string> = {
  offset_too_strict: "Offset Range Too Strict",
  width_too_strict: "Width Range Too Strict",
  diameter_too_strict: "Diameter Range Too Strict",
  bolt_pattern_mismatch: "Bolt Pattern Mismatch",
  center_bore_mismatch: "Center Bore Mismatch",
  no_products: "No Products Available",
};

export default function WheelProsAuditPage() {
  const [data, setData] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "issues" | "vehicles">("overview");

  useEffect(() => {
    fetch("/api/admin/fitment/wheelpros-audit")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load audit data");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading audit results...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800">Error Loading Audit</h2>
          <p className="mt-2 text-red-600">{error}</p>
          <p className="mt-4 text-sm text-gray-600">
            Run the audit pipeline first:
            <code className="ml-2 px-2 py-1 bg-gray-100 rounded">
              npx tsx scripts/wheelpros-fitment-audit-pipeline.ts
            </code>
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">WheelPros Fitment Audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Last run: {new Date(data.auditDate).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <SummaryCard
            label="Wheels Audited"
            value={data.summary.totalWheelsAudited}
            color="gray"
          />
          <SummaryCard
            label="Clean Matches"
            value={data.summary.totalCleanMatches}
            color="green"
          />
          <SummaryCard
            label="Aggressive Aftermarket"
            value={data.summary.totalAggressiveAftermarket}
            color="yellow"
          />
          <SummaryCard
            label="Unsafe Products"
            value={data.summary.totalUnsafe}
            color="red"
          />
          <SummaryCard
            label="Manual Review"
            value={data.summary.totalManualReview}
            color="purple"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </TabButton>
            <TabButton
              active={activeTab === "issues"}
              onClick={() => setActiveTab("issues")}
            >
              WTD Issues ({data.summary.topWTDIssues.length})
            </TabButton>
            <TabButton
              active={activeTab === "vehicles"}
              onClick={() => setActiveTab("vehicles")}
            >
              Vehicles ({data.vehicles.length})
            </TabButton>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "overview" && <OverviewTab data={data} />}
        {activeTab === "issues" && <IssuesTab issues={data.summary.topWTDIssues} />}
        {activeTab === "vehicles" && (
          <VehiclesTab
            vehicles={data.vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "gray" | "green" | "yellow" | "red" | "purple";
}) {
  const colorClasses = {
    gray: "bg-gray-50 border-gray-200",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
    purple: "bg-purple-50 border-purple-200",
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-1 border-b-2 font-medium text-sm ${
        active
          ? "border-blue-500 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function OverviewTab({ data }: { data: AuditSummary }) {
  const totalWheels = data.summary.totalWheelsAudited;
  const cleanPct = ((data.summary.totalCleanMatches / totalWheels) * 100).toFixed(1);
  const aggrPct = ((data.summary.totalAggressiveAftermarket / totalWheels) * 100).toFixed(1);
  const unsafePct = ((data.summary.totalUnsafe / totalWheels) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Distribution */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Wheel Classification Distribution</h3>
        <div className="h-8 flex rounded-lg overflow-hidden">
          <div
            className="bg-green-500"
            style={{ width: `${cleanPct}%` }}
            title={`Clean: ${cleanPct}%`}
          />
          <div
            className="bg-yellow-500"
            style={{ width: `${aggrPct}%` }}
            title={`Aggressive: ${aggrPct}%`}
          />
          <div
            className="bg-red-500"
            style={{ width: `${unsafePct}%` }}
            title={`Unsafe: ${unsafePct}%`}
          />
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className="text-green-600">Clean: {cleanPct}%</span>
          <span className="text-yellow-600">Aggressive: {aggrPct}%</span>
          <span className="text-red-600">Unsafe: {unsafePct}%</span>
        </div>
      </div>

      {/* Top Issues Preview */}
      {data.summary.topWTDIssues.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Top WTD Issues</h3>
          <div className="space-y-3">
            {data.summary.topWTDIssues.slice(0, 5).map((item, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${severityColors[item.issue.severity]}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-medium">{item.vehicle}</span>
                    <span className="mx-2">•</span>
                    <span>{issueTypeLabels[item.issue.type] || item.issue.type}</span>
                  </div>
                  <span className="text-xs uppercase font-bold">
                    {item.issue.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm">{item.issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Findings */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Key Findings</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start">
            <span className="text-green-500 mr-2">✓</span>
            <span>
              <strong>{cleanPct}%</strong> of wheels pass all safety checks
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-yellow-500 mr-2">⚠</span>
            <span>
              <strong>{aggrPct}%</strong> are aggressive aftermarket (plausible but outside OEM)
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-red-500 mr-2">✗</span>
            <span>
              <strong>{unsafePct}%</strong> have safety concerns (center bore or extreme specs)
            </span>
          </li>
          {data.summary.topWTDIssues.filter(i => i.issue.severity === "high").length > 0 && (
            <li className="flex items-start">
              <span className="text-red-500 mr-2">🔧</span>
              <span>
                <strong>
                  {data.summary.topWTDIssues.filter(i => i.issue.severity === "high").length}
                </strong>{" "}
                high-severity WTD issues detected
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function IssuesTab({
  issues,
}: {
  issues: Array<{ vehicle: string; issue: WTDIssue }>;
}) {
  const grouped = issues.reduce((acc, item) => {
    const type = item.issue.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, typeof issues>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold">
              {issueTypeLabels[type] || type}
              <span className="ml-2 text-gray-500 font-normal">
                ({items.length} vehicles)
              </span>
            </h3>
          </div>
          <div className="divide-y">
            {items.map((item, i) => (
              <div key={i} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{item.vehicle}</div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${
                      severityColors[item.issue.severity]
                    }`}
                  >
                    {item.issue.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{item.issue.description}</p>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">WTD Value</div>
                    <div className="font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                      {JSON.stringify(item.issue.evidence.wtdValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">WheelPros Value</div>
                    <div className="font-mono bg-gray-100 px-2 py-1 rounded mt-1">
                      {JSON.stringify(item.issue.evidence.wheelProsValue)}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Affected wheels: {item.issue.evidence.affectedWheels}
                </div>
                {item.issue.evidence.examples.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-500">Examples:</div>
                    <div className="mt-1 text-xs font-mono bg-gray-50 p-2 rounded">
                      {item.issue.evidence.examples.join(", ")}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VehiclesTab({
  vehicles,
  selectedVehicle,
  onSelectVehicle,
}: {
  vehicles: VehicleSummary[];
  selectedVehicle: string | null;
  onSelectVehicle: (v: string | null) => void;
}) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vehicle
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Specs
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Clean
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Aggressive
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Unsafe
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Issues
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {vehicles.map((v) => {
            const name = `${v.vehicle.year} ${v.vehicle.make} ${v.vehicle.model}`;
            return (
              <tr
                key={name}
                className={`hover:bg-gray-50 cursor-pointer ${
                  selectedVehicle === name ? "bg-blue-50" : ""
                }`}
                onClick={() => onSelectVehicle(selectedVehicle === name ? null : name)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{name}</div>
                  {v.vehicle.trim && (
                    <div className="text-sm text-gray-500">{v.vehicle.trim}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div>{v.wtdSpecs.boltPattern || "N/A"}</div>
                  <div>CB: {v.wtdSpecs.centerBoreMm || "N/A"}mm</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                    {v.cleanMatches}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                    {v.aggressiveAftermarket}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                    {v.unsafeProducts}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  {v.wtdIssues.length > 0 ? (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                      {v.wtdIssues.length}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Expanded vehicle details */}
      {selectedVehicle && (
        <VehicleDetail
          vehicle={vehicles.find(
            (v) =>
              `${v.vehicle.year} ${v.vehicle.make} ${v.vehicle.model}` === selectedVehicle
          )!}
          onClose={() => onSelectVehicle(null)}
        />
      )}
    </div>
  );
}

function VehicleDetail({
  vehicle,
  onClose,
}: {
  vehicle: VehicleSummary;
  onClose: () => void;
}) {
  const name = `${vehicle.vehicle.year} ${vehicle.vehicle.make} ${vehicle.vehicle.model}`;

  return (
    <div className="border-t bg-gray-50 p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold">{name} Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* WTD Specs */}
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium mb-3">WTD Canonical Specs</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Bolt Pattern</dt>
              <dd className="font-mono">{vehicle.wtdSpecs.boltPattern || "N/A"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Center Bore</dt>
              <dd className="font-mono">{vehicle.wtdSpecs.centerBoreMm || "N/A"}mm</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Offset Range</dt>
              <dd className="font-mono">{vehicle.wtdSpecs.offsetRange || "N/A"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Widths</dt>
              <dd className="font-mono">{vehicle.wtdSpecs.widths.join(", ") || "N/A"}"</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Diameters</dt>
              <dd className="font-mono">{vehicle.wtdSpecs.diameters.join(", ") || "N/A"}"</dd>
            </div>
          </dl>
        </div>

        {/* Classification Summary */}
        <div className="bg-white rounded-lg border p-4">
          <h4 className="font-medium mb-3">Classification Summary</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Total Wheels Queried</dt>
              <dd>{vehicle.totalWheelsQueried}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-green-600">Clean Matches</dt>
              <dd className="font-medium">{vehicle.cleanMatches}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-yellow-600">Aggressive Aftermarket</dt>
              <dd className="font-medium">{vehicle.aggressiveAftermarket}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-red-600">Unsafe Products</dt>
              <dd className="font-medium">{vehicle.unsafeProducts}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-purple-600">Manual Review Needed</dt>
              <dd className="font-medium">{vehicle.manualReviewNeeded}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Issues */}
      {vehicle.wtdIssues.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Detected Issues</h4>
          <div className="space-y-3">
            {vehicle.wtdIssues.map((issue, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${severityColors[issue.severity]}`}
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {issueTypeLabels[issue.type] || issue.type}
                  </span>
                  <span className="text-xs uppercase">{issue.severity}</span>
                </div>
                <p className="mt-1 text-sm">{issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
