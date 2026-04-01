"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "muscle", label: "Muscle Car", example: "Camaro, Mustang, Challenger" },
  { value: "truck", label: "Truck", example: "F-150, Silverado, RAM" },
  { value: "suv", label: "SUV", example: "Tahoe, Explorer, 4Runner" },
  { value: "sedan", label: "Sedan", example: "Accord, Camry, Model 3" },
  { value: "sports", label: "Sports Car", example: "Corvette, 911, Supra" },
  { value: "classic", label: "Classic", example: "Bel Air, Model A, Roadster" },
  { value: "compact", label: "Compact", example: "Civic, Golf, Corolla" },
];

export default function GenerateVehiclePage() {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [category, setCategory] = useState("muscle");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGenerating(true);
    setProgress("Generating vehicle image with DALL-E 3...");

    try {
      const res = await fetch("/api/admin/visualizer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: parseInt(year),
          make,
          model,
          category,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || "Generation failed";
        throw new Error(errorMsg);
      }

      setProgress("Draft created! Redirecting to review...");
      
      // Redirect to drafts review page
      setTimeout(() => {
        router.push(`/admin/visualizer/drafts/${data.draft.id}`);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
          🚗 Generate Vehicle Asset
        </h1>
        <p className="text-neutral-600 mb-8">
          Create a new visualizer-ready vehicle image using AI. The image will be
          generated as a draft for review before going live.
        </p>

        <form onSubmit={handleGenerate} className="space-y-6">
          {/* Year */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Year
            </label>
            <input
              type="number"
              min="1900"
              max="2030"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="1969"
              required
              disabled={generating}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-lg"
            />
          </div>

          {/* Make */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Make
            </label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Chevrolet"
              required
              disabled={generating}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-lg"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Model
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Camaro"
              required
              disabled={generating}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-lg"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={generating}
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg text-lg"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label} ({cat.example})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Category affects the generation prompt and default wheel positions
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              {progress}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={generating}
            className={`w-full py-4 rounded-lg font-semibold text-white text-lg transition-colors ${
              generating
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {generating ? "Generating..." : "🎨 Generate Vehicle Image"}
          </button>
        </form>

        {/* Info */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="font-bold text-amber-900 mb-2">ℹ️ How it works</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-amber-800">
            <li>DALL-E 3 generates a side-profile vehicle image</li>
            <li>AI analyzes the image to estimate wheel positions</li>
            <li>Draft is created for your review</li>
            <li>Adjust positions if needed, then approve</li>
          </ol>
          <p className="mt-3 text-xs text-amber-700">
            Cost: ~$0.08 per generation (DALL-E 3 HD)
          </p>
        </div>

        {/* Links */}
        <div className="mt-6 flex gap-4">
          <a
            href="/admin/visualizer/drafts"
            className="text-red-600 hover:underline font-medium"
          >
            📋 View Drafts
          </a>
          <a
            href="/admin/visualizer"
            className="text-neutral-600 hover:underline"
          >
            ← Back to Editor
          </a>
        </div>
      </div>
    </main>
  );
}
