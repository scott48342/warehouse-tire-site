/**
 * Admin: OEM Package Choices
 * 
 * Manage customer-friendly package labels for multi-config trims.
 */

import { getAllPackageChoices } from "@/lib/fitment/oemPackageChoices";
import { OemPackagesClient } from "./OemPackagesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OemPackagesPage() {
  const choices = await getAllPackageChoices({ limit: 200 });
  
  // Group by YMM/trim
  const grouped: Record<string, typeof choices> = {};
  for (const choice of choices) {
    const key = `${choice.year} ${choice.make} ${choice.model} ${choice.trim}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(choice);
  }

  const summary = {
    total: choices.length,
    pending: choices.filter(c => c.status === "pending").length,
    approved: choices.filter(c => c.status === "approved").length,
    rejected: choices.filter(c => c.status === "rejected").length,
    vehicles: Object.keys(grouped).length,
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          OEM Package Choices
        </h1>
        <p className="text-neutral-600 mb-6">
          Customer-friendly labels for multi-config trims. These replace the generic size chooser.
        </p>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-neutral-900">{summary.total}</div>
            <div className="text-sm text-neutral-500">Total Choices</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-amber-600">{summary.pending}</div>
            <div className="text-sm text-neutral-500">Pending</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
            <div className="text-sm text-neutral-500">Approved</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
            <div className="text-sm text-neutral-500">Rejected</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.vehicles}</div>
            <div className="text-sm text-neutral-500">Vehicles</div>
          </div>
        </div>

        {/* Client component for interactions */}
        <OemPackagesClient initialChoices={choices} grouped={grouped} />
      </div>
    </div>
  );
}
