'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';

// Lift presets with their visual descriptions
const LIFT_PRESETS = [
  { value: 'stock', label: 'Stock', description: 'factory ride height' },
  { value: 'leveling', label: 'Leveling Kit', description: '2" front leveling kit installed' },
  { value: 'lift-4', label: '4" Lift', description: '4 inch suspension lift kit' },
  { value: 'lift-6', label: '6" Lift', description: '6 inch suspension lift kit' },
] as const;

// Render styles
const RENDER_STYLES = [
  { value: 'studio', label: 'Studio', description: 'professional studio lighting, white/gray gradient background' },
  { value: 'outdoor', label: 'Outdoor', description: 'natural outdoor setting, subtle environment' },
  { value: 'aggressive', label: 'Aggressive', description: 'dramatic low angle, dynamic lighting' },
  { value: 'catalog', label: 'Clean Catalog', description: 'clean white background, even lighting, ecommerce ready' },
] as const;

// Common vehicle colors
const VEHICLE_COLORS = [
  'Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 
  'Yellow', 'Orange', 'Brown', 'Burgundy', 'Navy', 'Bronze',
  'Cement Gray', 'Army Green', 'Lunar Rock', 'Magnetic Gray'
];

interface FormState {
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  wheelImageUrl: string;
  wheelBrand: string;
  wheelModel: string;
  wheelSku: string;
  wheelDiameter: string;
  tireSize: string;
  liftPreset: string;
  renderStyle: string;
}

export default function AIPreviewTestPage() {
  const [form, setForm] = useState<FormState>({
    year: '2024',
    make: 'Toyota',
    model: 'Tundra',
    trim: 'TRD Pro',
    color: 'Lunar Rock',
    wheelImageUrl: 'https://www.wheelpros.com/images/wheels/F1932906557/1001/main.png',
    wheelBrand: 'Fuel',
    wheelModel: 'Reaction',
    wheelSku: 'D75320907050',
    wheelDiameter: '20',
    tireSize: '295/55R20',
    liftPreset: 'leveling',
    renderStyle: 'catalog',
  });

  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'prompt' | 'config' | 'key' | null>(null);

  // Generate cache key
  const cacheKey = useMemo(() => {
    const parts = [
      form.year,
      form.make.toLowerCase().replace(/\s+/g, '-'),
      form.model.toLowerCase().replace(/\s+/g, '-'),
      form.trim.toLowerCase().replace(/\s+/g, '-'),
      form.color.toLowerCase().replace(/\s+/g, '-'),
      form.wheelSku.toLowerCase(),
      `${form.wheelDiameter}in`,
      form.tireSize.replace(/\//g, '-'),
      form.liftPreset,
      form.renderStyle,
    ].filter(Boolean);
    return parts.join('_');
  }, [form]);

  // Generate structured prompt
  const generatedPrompt = useMemo(() => {
    const liftInfo = LIFT_PRESETS.find(l => l.value === form.liftPreset);
    const styleInfo = RENDER_STYLES.find(s => s.value === form.renderStyle);

    return `Professional automotive product photograph of a ${form.year} ${form.make} ${form.model} ${form.trim} in ${form.color} color, 3/4 front angle view.

Vehicle is equipped with ${form.wheelBrand} ${form.wheelModel} wheels (${form.wheelDiameter}" diameter) wrapped in ${form.tireSize} tires. The wheel design matches the reference product image exactly.

Suspension: ${liftInfo?.description || 'stock height'}.

Photography style: ${styleInfo?.description || 'clean catalog style'}.

Requirements:
- Realistic ecommerce product preview quality
- Wheels and tires are the focal point
- Accurate wheel fitment appearance for this vehicle
- No text, logos, or watermarks
- No visible license plates
- Clean, professional composition`;
  }, [form]);

  // Generate config object for API
  const configObject = useMemo(() => ({
    vehicle: {
      year: parseInt(form.year) || 0,
      make: form.make,
      model: form.model,
      trim: form.trim,
      color: form.color,
    },
    wheel: {
      brand: form.wheelBrand,
      model: form.wheelModel,
      sku: form.wheelSku,
      diameter: parseInt(form.wheelDiameter) || 0,
      imageUrl: form.wheelImageUrl,
    },
    tire: {
      size: form.tireSize,
    },
    render: {
      liftPreset: form.liftPreset,
      style: form.renderStyle,
      angle: '3/4-front',
    },
    cacheKey,
    prompt: generatedPrompt,
  }), [form, cacheKey, generatedPrompt]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setGeneratedImage(null); // Clear result on change
    setRevisedPrompt(null);
    setError(null);
  };

  const handleCopy = async (type: 'prompt' | 'config' | 'key') => {
    const text = type === 'prompt' ? generatedPrompt 
               : type === 'config' ? JSON.stringify(configObject, null, 2)
               : cacheKey;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImage(null);
    setRevisedPrompt(null);

    try {
      const response = await fetch('/api/visualizer-lab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generatedPrompt,
          cacheKey,
          config: configObject,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}${data.code ? ` (${data.code})` : ''}`
          : data.error || 'Generation failed';
        throw new Error(errorMsg);
      }

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setRevisedPrompt(data.revisedPrompt || null);
      } else {
        throw new Error('No image URL returned');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <a href="/visualizer-lab" className="hover:text-gray-300">Visualizer Lab</a>
            <span>/</span>
            <span className="text-gray-400">AI Preview Test</span>
          </div>
          <h1 className="text-3xl font-bold">AI Wheel Preview Prototype</h1>
          <p className="text-gray-400 mt-2">
            Proof-of-concept for "See this wheel on my vehicle" customer flow.
            Generates structured prompts for AI image generation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Inputs */}
          <div className="space-y-6">
            {/* Vehicle Info */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🚗</span> Vehicle Information
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Year</label>
                  <input
                    type="text"
                    value={form.year}
                    onChange={(e) => handleChange('year', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="2024"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Make</label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={(e) => handleChange('make', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => handleChange('model', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Tundra"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trim</label>
                  <input
                    type="text"
                    value={form.trim}
                    onChange={(e) => handleChange('trim', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="TRD Pro"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-1">Vehicle Color</label>
                <select
                  value={form.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  {VEHICLE_COLORS.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Wheel Info */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">⚙️</span> Wheel Information
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Brand</label>
                  <input
                    type="text"
                    value={form.wheelBrand}
                    onChange={(e) => handleChange('wheelBrand', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Fuel"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <input
                    type="text"
                    value={form.wheelModel}
                    onChange={(e) => handleChange('wheelModel', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Reaction"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.wheelSku}
                    onChange={(e) => handleChange('wheelSku', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="D75320907050"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Diameter</label>
                  <select
                    value={form.wheelDiameter}
                    onChange={(e) => handleChange('wheelDiameter', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    {['17', '18', '20', '22', '24', '26'].map(size => (
                      <option key={size} value={size}>{size}"</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-1">Wheel Image URL</label>
                <input
                  type="text"
                  value={form.wheelImageUrl}
                  onChange={(e) => handleChange('wheelImageUrl', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none text-sm"
                  placeholder="https://..."
                />
              </div>

              {/* Wheel Preview */}
              {form.wheelImageUrl && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4 flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <Image
                      src={form.wheelImageUrl}
                      alt="Wheel preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tire Info */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🛞</span> Tire Size
              </h2>
              <input
                type="text"
                value={form.tireSize}
                onChange={(e) => handleChange('tireSize', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="295/55R20"
              />
            </div>

            {/* Lift & Style */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">📸</span> Render Options
              </h2>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Lift Preset</label>
                <div className="grid grid-cols-2 gap-2">
                  {LIFT_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => handleChange('liftPreset', preset.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.liftPreset === preset.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Render Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {RENDER_STYLES.map(style => (
                    <button
                      key={style.value}
                      onClick={() => handleChange('renderStyle', style.value)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        form.renderStyle === style.value
                          ? 'bg-green-600 border-green-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Preview & Output */}
          <div className="space-y-6">
            {/* Preview Area */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4">Preview Area</h2>
              
              <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-700 overflow-hidden relative">
                {generating ? (
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Generating with DALL-E 3...</p>
                    <p className="text-xs text-gray-500 mt-1">This may take 10-20 seconds</p>
                  </div>
                ) : error ? (
                  <div className="text-center p-4">
                    <div className="text-6xl mb-4">❌</div>
                    <p className="text-red-400 font-semibold">Generation Failed</p>
                    <p className="text-xs text-red-300 mt-2 max-w-sm">{error}</p>
                  </div>
                ) : generatedImage ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={generatedImage}
                      alt="AI Generated Vehicle Preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">🖼️</div>
                    <p>AI-generated preview will appear here</p>
                    <p className="text-xs mt-1">Configure options and click Generate</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`w-full mt-4 py-3 rounded-lg font-semibold transition-colors ${
                  generating
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                }`}
              >
                {generating ? 'Generating...' : '🎨 Generate AI Preview'}
              </button>

              {generatedImage && (
                <div className="mt-4 flex gap-2">
                  <a
                    href={generatedImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center text-sm"
                  >
                    🔗 Open Full Size
                  </a>
                  <button
                    onClick={() => {
                      setGeneratedImage(null);
                      setRevisedPrompt(null);
                    }}
                    className="py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
                  >
                    Clear
                  </button>
                </div>
              )}

              {revisedPrompt && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">DALL-E revised prompt:</p>
                  <p className="text-xs text-gray-500 italic">{revisedPrompt}</p>
                </div>
              )}
            </div>

            {/* Cache Key */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Cache Key</h2>
                <button
                  onClick={() => handleCopy('key')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {copied === 'key' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <code className="block bg-gray-800 rounded-lg p-3 text-xs text-green-400 break-all font-mono">
                {cacheKey}
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Unique key for caching generated images. Same config = same key.
              </p>
            </div>

            {/* Generated Prompt */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Generated Prompt</h2>
                <button
                  onClick={() => handleCopy('prompt')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {copied === 'prompt' ? '✓ Copied!' : 'Copy Prompt'}
                </button>
              </div>
              <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-auto max-h-64">
                {generatedPrompt}
              </pre>
            </div>

            {/* Config Object */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">API Config Object</h2>
                <button
                  onClick={() => handleCopy('config')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {copied === 'config' ? '✓ Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="bg-gray-800 rounded-lg p-4 text-xs text-yellow-300 font-mono overflow-auto max-h-64">
                {JSON.stringify(configObject, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Architecture Notes */}
        <div className="mt-8 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">🏗️ Future Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-medium text-blue-400 mb-2">Customer Flow</h3>
              <ol className="list-decimal list-inside text-gray-400 space-y-1">
                <li>Customer selects wheel on PDP</li>
                <li>Clicks "See on my vehicle"</li>
                <li>Instant coded preview appears</li>
                <li>AI render generates in background</li>
                <li>High-quality image replaces preview</li>
              </ol>
            </div>
            <div>
              <h3 className="font-medium text-green-400 mb-2">Caching Strategy</h3>
              <ul className="list-disc list-inside text-gray-400 space-y-1">
                <li>Cache key = vehicle + wheel + config</li>
                <li>First request triggers generation</li>
                <li>Result cached to R2/S3</li>
                <li>Subsequent requests instant</li>
                <li>Popular combos pre-generated</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-purple-400 mb-2">AI Integration</h3>
              <ul className="list-disc list-inside text-gray-400 space-y-1">
                <li>Structured prompt from config</li>
                <li>Reference wheel image attached</li>
                <li>SDXL or Flux for generation</li>
                <li>Quality validation before cache</li>
                <li>Fallback to coded preview</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
