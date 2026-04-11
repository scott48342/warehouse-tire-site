'use client';

/**
 * Wheel Visualizer Test Page
 * 
 * URL: /visualizer-test
 * 
 * Uses the existing SteppedVehicleSelector for YMM selection.
 */

import { useState } from 'react';
import { SteppedVehicleSelector, type VehicleSelection } from '@/components/SteppedVehicleSelector';

interface VisualizerResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  cached?: boolean;
  generationTime?: number;
}

const COLORS = ['Red', 'Black', 'White', 'Blue', 'Silver', 'Yellow', 'Orange', 'Green', 'Gray', 'Brown'];

// Wheels with trained LoRAs on RunPod
const SAMPLE_WHEELS = [
  { sku: 'D596', name: 'Fuel Flame', lora: 'fuel_flame' },
  { sku: 'D604', name: 'Fuel Puma', lora: 'fuel_puma' },
  { sku: 'D753', name: 'Fuel Reaction', lora: 'fuel_reaction' },
  { sku: 'AB039', name: 'Asanti Black Mogul 5', loraName: 'asanti_black_ab039_mogul_5_wheel', triggerWord: 'asantiblackab039mogul5_wheel' },
  { sku: 'AB040', name: 'Asanti Black Tiara', loraName: 'asanti_black_ab040_tiara_wheel', triggerWord: 'asantiblackab040tiara_wheel' },
  { sku: 'AB041', name: 'Asanti Black Esquire', loraName: 'asanti_black_ab041_esquire_wheel', triggerWord: 'asantiblackab041esquire_wheel' },
];

export default function VisualizerTestPage() {
  const [vehicle, setVehicle] = useState<VehicleSelection | null>(null);
  const [selectedColor, setSelectedColor] = useState('Red');
  const [selectedWheel, setSelectedWheel] = useState(SAMPLE_WHEELS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualizerResult | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/wheel-viz/generate');
      const data = await res.json();
      setHealthStatus(JSON.stringify(data, null, 2));
    } catch (e) {
      setHealthStatus(`Error: ${e}`);
    }
  };

  const handleVehicleComplete = (selection: VehicleSelection) => {
    setVehicle(selection);
  };

  const resetVehicle = () => {
    setVehicle(null);
    setResult(null);
  };

  const generateVisualization = async () => {
    if (!vehicle) {
      alert('Please select a vehicle first');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/wheel-viz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: {
            year: parseInt(vehicle.year),
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
          },
          color: selectedColor,
          wheel: selectedWheel,
        }),
      });

      const data: VisualizerResult = await res.json();
      setResult(data);
    } catch (e) {
      setResult({
        success: false,
        error: e instanceof Error ? e.message : 'Request failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const vehicleLabel = vehicle 
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`
    : 'Select a vehicle';

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🚗 Wheel Visualizer Test</h1>
        <p className="text-gray-400 mb-8">Test page for on-demand wheel visualization</p>

        {/* Health Check */}
        <div className="mb-8 p-4 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={checkHealth}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            >
              Check Service Health
            </button>
            {healthStatus && (
              <pre className="text-sm text-gray-400 overflow-auto max-w-md">{healthStatus}</pre>
            )}
          </div>
        </div>

        {/* Vehicle Selection */}
        <div className="mb-8 p-6 bg-white rounded-lg text-gray-900">
          {!vehicle ? (
            <>
              <h2 className="font-bold mb-4 text-lg">Select Your Vehicle</h2>
              <SteppedVehicleSelector onComplete={handleVehicleComplete} />
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Selected Vehicle</div>
                <div className="text-xl font-bold">{vehicleLabel}</div>
              </div>
              <button
                onClick={resetVehicle}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
              >
                Change Vehicle
              </button>
            </div>
          )}
        </div>

        {/* Color & Wheel Selection - only show after vehicle selected */}
        {vehicle && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Color Selection */}
              <div className="p-4 bg-gray-800 rounded-lg">
                <h2 className="font-semibold mb-3">Vehicle Color</h2>
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full p-2 bg-gray-700 rounded"
                >
                  {COLORS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Wheel Selection */}
              <div className="p-4 bg-gray-800 rounded-lg">
                <h2 className="font-semibold mb-3">Wheel</h2>
                <select
                  value={JSON.stringify(selectedWheel)}
                  onChange={(e) => setSelectedWheel(JSON.parse(e.target.value))}
                  className="w-full p-2 bg-gray-700 rounded"
                >
                  {SAMPLE_WHEELS.map((w, i) => (
                    <option key={i} value={JSON.stringify(w)}>
                      {w.name} ({w.sku})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Generate Button */}
            <div className="mb-8">
              <button
                onClick={generateVisualization}
                disabled={loading}
                className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold text-lg transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating... (typically 3-5 seconds)
                  </span>
                ) : (
                  `🎨 Visualize ${selectedWheel.name} on ${selectedColor} ${vehicleLabel}`
                )}
              </button>
            </div>
          </>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 bg-gray-800 rounded-lg">
            {result.success ? (
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-green-400 font-semibold">✓ Generated successfully</span>
                  {result.cached && <span className="text-yellow-400">(cached)</span>}
                  {result.generationTime && (
                    <span className="text-gray-400">{result.generationTime}ms</span>
                  )}
                </div>
                {result.imageUrl && (
                  <div className="flex justify-center">
                    <img
                      src={result.imageUrl}
                      alt="Generated visualization"
                      className="max-w-full rounded-lg shadow-lg"
                      style={{ maxHeight: '512px' }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-400">
                <span className="font-semibold">✗ Generation failed:</span>
                <pre className="mt-2 text-sm">{result.error}</pre>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg text-sm text-gray-400">
          <h3 className="font-semibold text-white mb-2">Setup Instructions</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Add <code className="bg-gray-700 px-1 rounded">SDWEBUI_URL=https://your-runpod-url:3000</code> to .env.local</li>
            <li>Make sure the RunPod SD WebUI pod is running</li>
            <li>Ensure the wheel LoRAs are loaded (fuel_flame_wheel, etc.)</li>
            <li>Click "Check Service Health" to verify connection</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
