'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

// ============================================================================
// Constants
// ============================================================================

const LIFT_PRESETS = [
  { value: 'stock', label: 'Stock', description: 'factory ride height' },
  { value: 'leveling', label: 'Leveling Kit', description: '2" front leveling kit installed' },
  { value: 'lift-4', label: '4" Lift', description: '4 inch suspension lift kit' },
  { value: 'lift-6', label: '6" Lift', description: '6 inch suspension lift kit' },
] as const;

const RENDER_STYLES = [
  { value: 'studio', label: 'Studio', description: 'professional studio lighting, white/gray gradient background' },
  { value: 'outdoor', label: 'Outdoor', description: 'natural outdoor setting, subtle environment' },
  { value: 'aggressive', label: 'Aggressive', description: 'dramatic low angle, dynamic lighting' },
  { value: 'catalog', label: 'Clean Catalog', description: 'clean white background, even lighting, ecommerce ready' },
] as const;

const VEHICLE_COLORS = [
  'Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 
  'Yellow', 'Orange', 'Brown', 'Burgundy', 'Navy', 'Bronze',
  'Cement Gray', 'Army Green', 'Lunar Rock', 'Magnetic Gray'
];

// Preview states
type PreviewState = 
  | 'idle'
  | 'checking-cache'
  | 'cache-hit'
  | 'instant-preview'
  | 'generating'
  | 'generation-complete'
  | 'saving-cache'
  | 'error';

// ============================================================================
// Mock Cache (localStorage for prototype)
// ============================================================================

const CACHE_PREFIX = 'wtd_visualizer_cache_';

function getCachedImage(cacheKey: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Check expiry (7 days)
      if (data.expires > Date.now()) {
        return data.imageUrl;
      }
      localStorage.removeItem(CACHE_PREFIX + cacheKey);
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

function setCachedImage(cacheKey: string, imageUrl: string): void {
  if (typeof window === 'undefined') return;
  try {
    const data = {
      imageUrl,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      createdAt: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(data));
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

function getAllCacheKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keys.push(key.replace(CACHE_PREFIX, ''));
    }
  }
  return keys;
}

function clearCache(): void {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Main Component
// ============================================================================

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

  // YMM dropdown data
  const [years, setYears] = useState<number[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<string[]>([]);
  const [loadingYMM, setLoadingYMM] = useState({ years: false, makes: false, models: false, trims: false });

  // Wheel dropdown data
  const [wheelBrands, setWheelBrands] = useState<{ name: string; count: number }[]>([]);
  const [wheelStyles, setWheelStyles] = useState<{ name: string; imageUrl?: string; brand: string; skuExample: string }[]>([]);
  const [loadingWheels, setLoadingWheels] = useState({ brands: false, styles: false });

  // Preview state machine
  const [previewState, setPreviewState] = useState<PreviewState>('idle');
  const [cachedImage, setCachedImageState] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [copied, setCopied] = useState<'prompt' | 'config' | 'key' | null>(null);

  // Admin mode
  const [showAdmin, setShowAdmin] = useState(false);
  const [cacheStats, setCacheStats] = useState({ count: 0, keys: [] as string[] });

  // Polling ref for background generation
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Data Fetching Effects
  // ============================================================================

  useEffect(() => {
    setLoadingYMM(prev => ({ ...prev, years: true }));
    fetch('/api/vehicles/all-years')
      .then(res => res.json())
      .then(data => setYears(data.years || []))
      .catch(console.error)
      .finally(() => setLoadingYMM(prev => ({ ...prev, years: false })));
  }, []);

  useEffect(() => {
    if (!form.year) return;
    setLoadingYMM(prev => ({ ...prev, makes: true }));
    fetch(`/api/vehicles/makes?year=${form.year}`)
      .then(res => res.json())
      .then(data => setMakes(data.results || []))
      .catch(console.error)
      .finally(() => setLoadingYMM(prev => ({ ...prev, makes: false })));
  }, [form.year]);

  useEffect(() => {
    if (!form.year || !form.make) return;
    setLoadingYMM(prev => ({ ...prev, models: true }));
    fetch(`/api/vehicles/models?year=${form.year}&make=${encodeURIComponent(form.make)}`)
      .then(res => res.json())
      .then(data => setModels(data.results || []))
      .catch(console.error)
      .finally(() => setLoadingYMM(prev => ({ ...prev, models: false })));
  }, [form.year, form.make]);

  useEffect(() => {
    if (!form.year || !form.make || !form.model) return;
    setLoadingYMM(prev => ({ ...prev, trims: true }));
    fetch(`/api/vehicles/trims?year=${form.year}&make=${encodeURIComponent(form.make)}&model=${encodeURIComponent(form.model)}`)
      .then(res => res.json())
      .then(data => {
        const trimList = (data.results || []).map((t: { label?: string; value?: string } | string) => 
          typeof t === 'string' ? t : t.label || t.value || ''
        ).filter(Boolean);
        setTrims(trimList);
      })
      .catch(console.error)
      .finally(() => setLoadingYMM(prev => ({ ...prev, trims: false })));
  }, [form.year, form.make, form.model]);

  useEffect(() => {
    setLoadingWheels(prev => ({ ...prev, brands: true }));
    fetch('/api/wheels/brands')
      .then(res => res.json())
      .then(data => setWheelBrands(data.brands || []))
      .catch(console.error)
      .finally(() => setLoadingWheels(prev => ({ ...prev, brands: false })));
  }, []);

  useEffect(() => {
    if (!form.wheelBrand) {
      setWheelStyles([]);
      return;
    }
    setLoadingWheels(prev => ({ ...prev, styles: true }));
    fetch(`/api/wheels/styles?brand=${encodeURIComponent(form.wheelBrand)}`)
      .then(res => res.json())
      .then(data => setWheelStyles(data.styles || []))
      .catch(console.error)
      .finally(() => setLoadingWheels(prev => ({ ...prev, styles: false })));
  }, [form.wheelBrand]);

  // Update cache stats for admin
  useEffect(() => {
    const keys = getAllCacheKeys();
    setCacheStats({ count: keys.length, keys });
  }, [generatedImage, previewState]);

  // ============================================================================
  // Derived Values
  // ============================================================================

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

  // Detect vehicle type for tire appearance
  const vehicleType = useMemo(() => {
    const model = form.model.toLowerCase();
    const sportsCars = ['camaro', 'mustang', 'corvette', 'challenger', 'charger', 'supra', '370z', '350z', 'gt-r', 'gtr', 'wrx', 'sti', 'miata', 'mx-5', '86', 'brz', 'genesis coupe', 'm3', 'm4', 'm5', 'amg', 'rs3', 'rs5', 'rs7', 'civic type r', 'type-r'];
    if (sportsCars.some(car => model.includes(car))) return 'sports';
    const trucks = ['f-150', 'f150', 'f-250', 'f250', 'f-350', 'silverado', 'sierra', 'ram', 'tundra', 'titan', 'tacoma', 'ranger', 'colorado', 'canyon', 'gladiator', 'frontier', 'ridgeline'];
    if (trucks.some(truck => model.includes(truck))) return 'truck';
    const offroad = ['wrangler', 'bronco', '4runner', 'land cruiser', 'defender', 'g-wagon', 'g wagon'];
    if (offroad.some(or => model.includes(or))) return 'offroad';
    const suvs = ['tahoe', 'suburban', 'yukon', 'expedition', 'sequoia', 'armada', 'durango', 'explorer', 'highlander', 'pilot', 'pathfinder', 'telluride', 'palisade'];
    if (suvs.some(suv => model.includes(suv))) return 'suv';
    return 'car';
  }, [form.model]);

  const tireStyleDescription = useMemo(() => {
    switch (vehicleType) {
      case 'sports': return 'low-profile performance tires with thin sidewalls, sporty appearance';
      case 'truck': return form.liftPreset !== 'stock' ? 'aggressive all-terrain tires with bold sidewall lettering' : 'highway truck tires with appropriate sidewall height';
      case 'offroad': return 'rugged all-terrain or mud-terrain tires with aggressive tread pattern';
      case 'suv': return 'SUV touring tires with moderate sidewall height';
      default: return 'passenger car tires with standard sidewall profile';
    }
  }, [vehicleType, form.liftPreset]);

  // Get wheel style description based on brand/model name
  const wheelStyleDescription = useMemo(() => {
    const model = form.wheelModel.toLowerCase();
    const brand = form.wheelBrand.toLowerCase();
    
    // Try to infer wheel style from name
    if (model.includes('forged') || model.includes('forge')) return 'premium forged aluminum multi-spoke design';
    if (model.includes('mesh')) return 'intricate mesh spoke pattern';
    if (model.includes('split')) return 'split 5-spoke design';
    if (model.includes('flow') || model.includes('rotary')) return 'flow-formed lightweight design';
    if (model.includes('beadlock') || model.includes('bead')) return 'aggressive beadlock-style ring design';
    if (model.includes('stealth') || model.includes('matte')) return 'stealthy matte black finish';
    if (model.includes('chrome') || model.includes('polished')) return 'polished chrome finish';
    if (model.includes('bronze') || model.includes('copper')) return 'bronze/copper tinted finish';
    
    // Brand-specific defaults
    if (brand === 'fuel') return 'aggressive off-road style with bold spoke design';
    if (brand === 'method') return 'rugged off-road racing inspired design';
    if (brand === 'kmc') return 'modern street/off-road crossover design';
    if (brand === 'american force') return 'bold American-style forged design';
    if (brand === 'hostile') return 'aggressive lifted truck style';
    if (brand === 'vision') return 'classic multi-spoke design';
    
    return 'aftermarket alloy wheel design';
  }, [form.wheelBrand, form.wheelModel]);

  const generatedPrompt = useMemo(() => {
    const liftInfo = LIFT_PRESETS.find(l => l.value === form.liftPreset);
    const styleInfo = RENDER_STYLES.find(s => s.value === form.renderStyle);
    
    // Emphasize color more clearly
    const colorEmphasis = form.color.toLowerCase().includes('rock') ? `distinctive ${form.color}` 
      : form.color.toLowerCase().includes('gray') || form.color.toLowerCase().includes('grey') ? `${form.color} metallic`
      : form.color;
    
    return `Professional automotive product photograph of a ${form.year} ${form.make} ${form.model} ${form.trim}.

IMPORTANT: The vehicle body color is ${colorEmphasis}. The entire vehicle exterior must be this exact color.

The vehicle is equipped with ${form.wheelBrand} ${form.wheelModel} aftermarket wheels - ${wheelStyleDescription}. Wheel diameter is ${form.wheelDiameter} inches. Tires are ${form.tireSize} - ${tireStyleDescription}.

Suspension: ${liftInfo?.description || 'stock height'}.

Camera angle: 3/4 front view showing the vehicle's front and driver side.

Photography style: ${styleInfo?.description || 'clean catalog style'}.

Critical requirements:
- Vehicle body MUST be ${form.color} color - this is essential
- Aftermarket wheels must look premium and realistic
- ${tireStyleDescription}
- Realistic ecommerce product preview quality
- No text, logos, watermarks, or license plates
- Clean, professional automotive photography`;
  }, [form, tireStyleDescription, wheelStyleDescription]);

  const configObject = useMemo(() => ({
    vehicle: { year: parseInt(form.year) || 0, make: form.make, model: form.model, trim: form.trim, color: form.color },
    wheel: { brand: form.wheelBrand, model: form.wheelModel, sku: form.wheelSku, diameter: parseInt(form.wheelDiameter) || 0, imageUrl: form.wheelImageUrl },
    tire: { size: form.tireSize },
    render: { liftPreset: form.liftPreset, style: form.renderStyle, angle: '3/4-front' },
    cacheKey,
    prompt: generatedPrompt,
  }), [form, cacheKey, generatedPrompt]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleChange = useCallback((field: keyof FormState, value: string) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'year') { updated.make = ''; updated.model = ''; updated.trim = ''; setMakes([]); setModels([]); setTrims([]); }
      else if (field === 'make') { updated.model = ''; updated.trim = ''; setModels([]); setTrims([]); }
      else if (field === 'model') { updated.trim = ''; setTrims([]); }
      if (field === 'wheelBrand') { updated.wheelModel = ''; updated.wheelImageUrl = ''; updated.wheelSku = ''; setWheelStyles([]); }
      return updated;
    });
    // Reset preview state on config change
    setPreviewState('idle');
    setCachedImageState(null);
    setGeneratedImage(null);
    setRevisedPrompt(null);
    setError(null);
    setGenerationProgress(0);
  }, []);

  const handleWheelStyleChange = useCallback((styleName: string) => {
    const style = wheelStyles.find(s => s.name === styleName);
    setForm(prev => ({ ...prev, wheelModel: styleName, wheelImageUrl: style?.imageUrl || '', wheelSku: style?.skuExample || '' }));
    setPreviewState('idle');
    setCachedImageState(null);
    setGeneratedImage(null);
    setRevisedPrompt(null);
    setError(null);
  }, [wheelStyles]);

  const handleCopy = useCallback(async (type: 'prompt' | 'config' | 'key') => {
    const text = type === 'prompt' ? generatedPrompt : type === 'config' ? JSON.stringify(configObject, null, 2) : cacheKey;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, [generatedPrompt, configObject, cacheKey]);

  // ============================================================================
  // Preview Flow: Cache-First + Background Generation
  // ============================================================================

  const checkCacheAndShowPreview = useCallback(async () => {
    setPreviewState('checking-cache');
    setError(null);
    setGenerationProgress(0);

    // Simulate brief cache check
    await new Promise(r => setTimeout(r, 300));

    // Check cache first
    const cached = getCachedImage(cacheKey);
    if (cached) {
      setCachedImageState(cached);
      setGeneratedImage(cached);
      setPreviewState('cache-hit');
      return;
    }

    // No cache - show instant placeholder preview
    setPreviewState('instant-preview');
  }, [cacheKey]);

  const generateInBackground = useCallback(async () => {
    if (previewState !== 'instant-preview') return;
    
    setPreviewState('generating');
    setGenerationProgress(10);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 85));
    }, 2000);

    try {
      const response = await fetch('/api/visualizer-lab/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: generatedPrompt, cacheKey, config: configObject }),
      });

      clearInterval(progressInterval);
      setGenerationProgress(90);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details ? `${data.error}: ${data.details}` : data.error || 'Generation failed');
      }

      if (data.imageUrl) {
        setGenerationProgress(95);
        setPreviewState('saving-cache');
        
        // Save to cache
        setCachedImage(cacheKey, data.imageUrl);
        
        await new Promise(r => setTimeout(r, 500)); // Brief pause to show saving state
        
        setGeneratedImage(data.imageUrl);
        setRevisedPrompt(data.revisedPrompt || null);
        setGenerationProgress(100);
        setPreviewState('generation-complete');
      } else {
        throw new Error('No image URL returned');
      }
    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setPreviewState('error');
    }
  }, [previewState, generatedPrompt, cacheKey, configObject]);

  // Auto-generate when instant preview is shown
  useEffect(() => {
    if (previewState === 'instant-preview') {
      // Small delay before starting background generation
      const timeout = setTimeout(() => {
        generateInBackground();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [previewState, generateInBackground]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ============================================================================
  // Progress/Status Display Helpers
  // ============================================================================

  const getStatusMessage = () => {
    switch (previewState) {
      case 'idle': return { icon: '🖼️', text: 'Configure your build and click Preview', sub: '' };
      case 'checking-cache': return { icon: '🔍', text: 'Checking cache...', sub: '' };
      case 'cache-hit': return { icon: '⚡', text: 'Loaded from cache!', sub: 'Instant delivery' };
      case 'instant-preview': return { icon: '🚗', text: 'Instant preview ready', sub: 'Generating realistic version...' };
      case 'generating': return { icon: '🎨', text: 'Generating AI preview...', sub: `${Math.round(generationProgress)}% complete` };
      case 'saving-cache': return { icon: '💾', text: 'Saving to cache...', sub: 'Future views will load instantly' };
      case 'generation-complete': return { icon: '✅', text: 'Realistic preview ready!', sub: 'Cached for instant future loads' };
      case 'error': return { icon: '❌', text: 'Generation failed', sub: error || '' };
      default: return { icon: '🖼️', text: '', sub: '' };
    }
  };

  const status = getStatusMessage();

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <a href="/visualizer-lab" className="hover:text-gray-300">Visualizer Lab</a>
              <span>/</span>
              <span className="text-gray-400">AI Preview Test</span>
            </div>
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              {showAdmin ? 'Hide Admin' : 'Show Admin'}
            </button>
          </div>
          <h1 className="text-3xl font-bold">AI Wheel Preview Prototype</h1>
          <p className="text-gray-400 mt-2">
            Cache-first UX: Instant coded preview → AI renders in background → Cached for future instant loads.
          </p>
        </div>

        {/* Admin Panel */}
        {showAdmin && (
          <div className="mb-6 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
            <h3 className="font-semibold text-yellow-400 mb-3">🔧 Admin / Pre-generate Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Cache Stats</p>
                <p className="text-white">{cacheStats.count} cached previews</p>
              </div>
              <div>
                <p className="text-gray-400">Current Cache Key</p>
                <p className="text-xs text-green-400 font-mono truncate">{cacheKey.substring(0, 40)}...</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { clearCache(); setCacheStats({ count: 0, keys: [] }); }}
                  className="px-3 py-1 bg-red-600/20 border border-red-600/50 rounded text-red-400 hover:bg-red-600/30"
                >
                  Clear Cache
                </button>
                <button
                  onClick={() => {
                    // Simulate pre-generating popular combo
                    const fakeKey = 'pregenerated_' + Date.now();
                    setCachedImage(fakeKey, 'https://via.placeholder.com/800x450?text=Pre-generated');
                    setCacheStats(prev => ({ ...prev, count: prev.count + 1 }));
                  }}
                  className="px-3 py-1 bg-green-600/20 border border-green-600/50 rounded text-green-400 hover:bg-green-600/30"
                >
                  Mock Pre-gen
                </button>
              </div>
            </div>
            {cacheStats.keys.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Cached keys:</p>
                <div className="flex flex-wrap gap-1">
                  {cacheStats.keys.slice(0, 5).map(k => (
                    <span key={k} className="text-xs bg-gray-800 px-2 py-0.5 rounded font-mono">{k.substring(0, 25)}...</span>
                  ))}
                  {cacheStats.keys.length > 5 && <span className="text-xs text-gray-500">+{cacheStats.keys.length - 5} more</span>}
                </div>
              </div>
            )}
          </div>
        )}

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
                  <select value={form.year} onChange={(e) => handleChange('year', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none" disabled={loadingYMM.years}>
                    <option value="">Select Year</option>
                    {years.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Make</label>
                  <select value={form.make} onChange={(e) => handleChange('make', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none disabled:opacity-50" disabled={!form.year || loadingYMM.makes}>
                    <option value="">{loadingYMM.makes ? 'Loading...' : 'Select Make'}</option>
                    {makes.map(make => <option key={make} value={make}>{make}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <select value={form.model} onChange={(e) => handleChange('model', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none disabled:opacity-50" disabled={!form.make || loadingYMM.models}>
                    <option value="">{loadingYMM.models ? 'Loading...' : 'Select Model'}</option>
                    {models.map(model => <option key={model} value={model}>{model}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trim</label>
                  <select value={form.trim} onChange={(e) => handleChange('trim', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none disabled:opacity-50" disabled={!form.model || loadingYMM.trims}>
                    <option value="">{loadingYMM.trims ? 'Loading...' : 'Select Trim'}</option>
                    {trims.map(trim => <option key={trim} value={trim}>{trim}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-1">Vehicle Color</label>
                <select value={form.color} onChange={(e) => handleChange('color', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none">
                  {VEHICLE_COLORS.map(color => <option key={color} value={color}>{color}</option>)}
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
                  <select value={form.wheelBrand} onChange={(e) => handleChange('wheelBrand', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none" disabled={loadingWheels.brands}>
                    <option value="">{loadingWheels.brands ? 'Loading...' : 'Select Brand'}</option>
                    {wheelBrands.map(brand => <option key={brand.name} value={brand.name}>{brand.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Model</label>
                  <select value={form.wheelModel} onChange={(e) => handleWheelStyleChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none disabled:opacity-50" disabled={!form.wheelBrand || loadingWheels.styles}>
                    <option value="">{loadingWheels.styles ? 'Loading...' : 'Select Model'}</option>
                    {wheelStyles.map(style => <option key={style.name} value={style.name}>{style.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SKU</label>
                  <input type="text" value={form.wheelSku} readOnly className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-400" placeholder="Auto-filled" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Diameter</label>
                  <select value={form.wheelDiameter} onChange={(e) => handleChange('wheelDiameter', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none">
                    {['17', '18', '20', '22', '24', '26'].map(size => <option key={size} value={size}>{size}"</option>)}
                  </select>
                </div>
              </div>

              {form.wheelImageUrl && (
                <div className="mt-4 bg-gray-800 rounded-lg p-4 flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <Image src={form.wheelImageUrl} alt="Wheel preview" fill className="object-contain" unoptimized />
                  </div>
                </div>
              )}
            </div>

            {/* Tire Info */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-2xl">🛞</span> Tire Size
              </h2>
              <input type="text" value={form.tireSize} onChange={(e) => handleChange('tireSize', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:border-blue-500 focus:outline-none" placeholder="295/55R20" />
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
                    <button key={preset.value} onClick={() => handleChange('liftPreset', preset.value)} className={`px-4 py-2 rounded-lg border text-sm transition-colors ${form.liftPreset === preset.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Render Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {RENDER_STYLES.map(style => (
                    <button key={style.value} onClick={() => handleChange('renderStyle', style.value)} className={`px-4 py-2 rounded-lg border text-sm transition-colors ${form.renderStyle === style.value ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'}`}>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Preview Area</h2>
                <span className={`text-xs px-2 py-1 rounded ${previewState === 'cache-hit' ? 'bg-green-600/20 text-green-400' : previewState === 'generation-complete' ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                  {previewState === 'cache-hit' ? '⚡ CACHED' : previewState === 'generation-complete' ? '✨ AI GENERATED' : previewState === 'instant-preview' || previewState === 'generating' ? '🎨 GENERATING...' : ''}
                </span>
              </div>
              
              {/* Main Preview Display */}
              <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-700 overflow-hidden relative">
                {/* Show generated/cached image if available */}
                {(generatedImage || cachedImage) && previewState !== 'idle' && previewState !== 'checking-cache' ? (
                  <div className="relative w-full h-full">
                    <Image src={generatedImage || cachedImage || ''} alt="Vehicle Preview" fill className="object-contain" unoptimized />
                    {/* Overlay for generating state */}
                    {(previewState === 'instant-preview' || previewState === 'generating') && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="text-center bg-black/70 rounded-lg px-4 py-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-300">Generating realistic version...</p>
                          <p className="text-xs text-gray-500">{Math.round(generationProgress)}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : previewState === 'instant-preview' || previewState === 'generating' ? (
                  /* Instant coded preview placeholder */
                  <div className="relative w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-8xl mb-4 opacity-30">🚗</div>
                      <p className="text-gray-400 font-medium">{form.year} {form.make} {form.model}</p>
                      <p className="text-sm text-gray-500">{form.wheelBrand} {form.wheelModel} wheels</p>
                      <div className="mt-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p className="text-xs text-gray-500">Generating AI preview...</p>
                      </div>
                    </div>
                  </div>
                ) : previewState === 'checking-cache' ? (
                  <div className="text-center">
                    <div className="animate-pulse text-6xl mb-4">🔍</div>
                    <p className="text-gray-400">Checking cache...</p>
                  </div>
                ) : previewState === 'error' ? (
                  <div className="text-center p-4">
                    <div className="text-6xl mb-4">❌</div>
                    <p className="text-red-400 font-semibold">Generation Failed</p>
                    <p className="text-xs text-red-300 mt-2 max-w-sm">{error}</p>
                  </div>
                ) : (
                  /* Idle state */
                  <div className="text-center text-gray-500">
                    <div className="text-6xl mb-4">🖼️</div>
                    <p>Configure your build and click Preview</p>
                    <p className="text-xs mt-1 text-gray-600">Instant preview → AI generates in background</p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {(previewState === 'generating' || previewState === 'saving-cache') && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{status.text}</span>
                    <span>{Math.round(generationProgress)}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" style={{ width: `${generationProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={checkCacheAndShowPreview}
                disabled={previewState === 'checking-cache' || previewState === 'generating' || previewState === 'saving-cache'}
                className={`w-full mt-4 py-3 rounded-lg font-semibold transition-colors ${
                  previewState === 'checking-cache' || previewState === 'generating' || previewState === 'saving-cache'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                }`}
              >
                {previewState === 'checking-cache' ? '🔍 Checking Cache...' 
                  : previewState === 'generating' ? '🎨 Generating...'
                  : previewState === 'saving-cache' ? '💾 Saving...'
                  : previewState === 'cache-hit' || previewState === 'generation-complete' ? '🔄 Regenerate Preview'
                  : '👁️ Preview Build'}
              </button>

              {/* Info Text */}
              <p className="text-xs text-gray-500 text-center mt-3">
                ⚡ Realistic preview may take 15–45 seconds the first time. Future views load instantly.
              </p>

              {/* Actions for completed preview */}
              {(previewState === 'cache-hit' || previewState === 'generation-complete') && generatedImage && (
                <div className="mt-4 flex gap-2">
                  <a href={generatedImage} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-center text-sm">
                    🔗 Open Full Size
                  </a>
                  <button onClick={() => { setPreviewState('idle'); setGeneratedImage(null); setCachedImageState(null); }} className="py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">
                    Clear
                  </button>
                </div>
              )}

              {revisedPrompt && (
                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-400 mb-1">AI revised prompt:</p>
                  <p className="text-xs text-gray-500 italic">{revisedPrompt}</p>
                </div>
              )}
            </div>

            {/* Status Card */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{status.icon}</span>
                <div>
                  <p className="font-medium">{status.text}</p>
                  {status.sub && <p className="text-xs text-gray-500">{status.sub}</p>}
                </div>
              </div>
            </div>

            {/* Cache Key */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Cache Key</h2>
                <button onClick={() => handleCopy('key')} className="text-sm text-blue-400 hover:text-blue-300">
                  {copied === 'key' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              <code className="block bg-gray-800 rounded-lg p-3 text-xs text-green-400 break-all font-mono">{cacheKey}</code>
            </div>

            {/* Generated Prompt */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Generated Prompt</h2>
                <button onClick={() => handleCopy('prompt')} className="text-sm text-blue-400 hover:text-blue-300">
                  {copied === 'prompt' ? '✓ Copied!' : 'Copy Prompt'}
                </button>
              </div>
              <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono overflow-auto max-h-48">{generatedPrompt}</pre>
            </div>

            {/* Config Object */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">API Config Object</h2>
                <button onClick={() => handleCopy('config')} className="text-sm text-blue-400 hover:text-blue-300">
                  {copied === 'config' ? '✓ Copied!' : 'Copy JSON'}
                </button>
              </div>
              <pre className="bg-gray-800 rounded-lg p-4 text-xs text-yellow-300 font-mono overflow-auto max-h-48">{JSON.stringify(configObject, null, 2)}</pre>
            </div>
          </div>
        </div>

        {/* Architecture Notes */}
        <div className="mt-8 bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">🏗️ Cache-First Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div>
              <h3 className="font-medium text-blue-400 mb-2">1. Check Cache</h3>
              <p className="text-gray-400">Instant lookup by config hash. If found, show immediately (⚡ &lt;100ms).</p>
            </div>
            <div>
              <h3 className="font-medium text-purple-400 mb-2">2. Instant Preview</h3>
              <p className="text-gray-400">Show coded placeholder immediately while AI generates in background.</p>
            </div>
            <div>
              <h3 className="font-medium text-green-400 mb-2">3. Background Gen</h3>
              <p className="text-gray-400">AI renders 15-45s. Progress shown. User can continue browsing.</p>
            </div>
            <div>
              <h3 className="font-medium text-yellow-400 mb-2">4. Cache & Serve</h3>
              <p className="text-gray-400">Result cached. Next customer with same config gets instant load.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
