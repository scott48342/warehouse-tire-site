export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function FitmentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fitment Overrides</h1>
        <p className="text-neutral-400 mt-1">
          Search for a vehicle to edit its fitment data
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              Year
            </label>
            <select className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white">
              <option value="">Select year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              Make
            </label>
            <select className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white">
              <option value="">Select make</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
              Model
            </label>
            <select className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white">
              <option value="">Select model</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full h-10 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-8 text-center">
        <div className="text-4xl mb-4">🔧</div>
        <div className="text-lg font-medium text-white">Coming Soon</div>
        <div className="text-sm text-neutral-400 mt-1">
          Fitment override editor will be available in the next update
        </div>
      </div>
    </div>
  );
}
