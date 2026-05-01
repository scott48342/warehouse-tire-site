"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Phone, 
  MapPin, 
  Clock, 
  CheckCircle, 
  Users, 
  Truck, 
  DollarSign, 
  Shield,
  Star,
  Calendar,
  Heart,
  Navigation,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL HOMEPAGE - Neighborhood Tire Store
// ═══════════════════════════════════════════════════════════════════════════════
// 
// MOBILE-FIRST OPTIMIZED + READABILITY POLISH (2026-05-01)
// Typography scaled up for mobile readability
// Larger icons, stronger shadows, better tap targets
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// STORE DATA
// ═══════════════════════════════════════════════════════════════════════════════

const STORES = [
  {
    id: "pontiac",
    name: "Pontiac",
    address: "1100 Cesar E Chavez Ave",
    city: "Pontiac, MI 48340",
    phone: "(248) 332-4120",
    hours: "Mon-Fri 8AM-5PM, Sat 8AM-3PM",
    mapsUrl: "https://maps.google.com/?q=1100+Cesar+E+Chavez+Ave+Pontiac+MI+48340",
  },
  {
    id: "waterford",
    name: "Waterford",
    address: "4459 Pontiac Lake Rd",
    city: "Waterford, MI 48328",
    phone: "(248) 683-0070",
    hours: "Mon-Fri 8AM-5PM, Sat 8AM-3PM",
    mapsUrl: "https://maps.google.com/?q=4459+Pontiac+Lake+Rd+Waterford+MI+48328",
  },
];

const PRIMARY_STORE = STORES[0];

// ═══════════════════════════════════════════════════════════════════════════════
// TIRE BRANDS
// ═══════════════════════════════════════════════════════════════════════════════

const TIRE_BRANDS = [
  { name: "Michelin" },
  { name: "BFGoodrich" },
  { name: "Goodyear" },
  { name: "Pirelli" },
  { name: "Continental" },
  { name: "Bridgestone" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => String(THIS_YEAR - i));

function HeroSection() {
  const router = useRouter();
  const [searchTab, setSearchTab] = useState<"vehicle" | "size">("vehicle");
  
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const [width, setWidth] = useState("");
  const [aspect, setAspect] = useState("");
  const [rim, setRim] = useState("");

  useEffect(() => {
    if (!year) { setMakes([]); setMake(""); return; }
    setLoading("makes");
    fetch(`/api/vehicles/makes?year=${year}`)
      .then(r => r.json())
      .then(d => setMakes(d.results || []))
      .catch(() => setMakes([]))
      .finally(() => setLoading(null));
  }, [year]);

  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(""); return; }
    setLoading("models");
    fetch(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then(r => r.json())
      .then(d => setModels(d.results || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(null));
  }, [year, make]);

  useEffect(() => {
    if (!year || !make || !model) { setTrims([]); setTrim(""); return; }
    setLoading("trims");
    fetch(`/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then(r => r.json())
      .then(d => setTrims(d.results || []))
      .catch(() => setTrims([]))
      .finally(() => setLoading(null));
  }, [year, make, model]);

  const canSearchVehicle = year && make && model;
  const canSearchSize = width && aspect && rim;

  const handleVehicleSearch = () => {
    if (!canSearchVehicle) return;
    const params = new URLSearchParams({ year, make, model });
    if (trim) params.set("trim", trim);
    router.push(`/tires?${params.toString()}`);
  };

  const handleSizeSearch = () => {
    if (!canSearchSize) return;
    router.push(`/tires?size=${width}/${aspect}R${rim}`);
  };

  const WIDTHS = [175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315];
  const ASPECTS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
  const RIMS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 24];

  return (
    <section className="relative">
      {/* ═══════════════════════════════════════════════════════════════════════
          MOBILE HERO
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden relative">
        {/* Background Image with STRONGER gradient */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/homepage/storefront.jpg"
            alt="Warehouse Tire storefront"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />
        </div>
        
        {/* Mobile Content - LARGER TEXT */}
        <div className="relative z-10 px-6 pt-10 pb-8">
          {/* Eyebrow - LARGER */}
          <p className="text-sm font-bold tracking-widest text-green-400 uppercase">
            Your Local Tire Shop
          </p>
          
          {/* Headline - MUCH LARGER */}
          <h1 className="mt-3 text-[2.5rem] leading-[1.1] font-extrabold text-white">
            Great Tires.<br />
            Honest Prices.<br />
            Local People.
          </h1>
          
          {/* Subheadline - LARGER */}
          <p className="mt-4 text-base text-white/90 max-w-sm leading-relaxed">
            Fast local installation and honest pricing you can trust.
          </p>
          
          {/* Trust bullets - LARGER icons and text */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            {[
              "Same-Day Install",
              "Expert Install", 
              "Honest Pricing",
              "Local & Trusted"
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-sm font-medium text-white">{item}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Mobile Search Card - LARGER EVERYTHING */}
        <div className="relative z-10 px-4 pb-6">
          <div className="bg-white rounded-2xl shadow-2xl p-5">
            {/* Tabs - LARGER */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setSearchTab("vehicle")}
                className={`flex-1 py-3.5 rounded-xl text-base font-bold transition-all ${
                  searchTab === "vehicle"
                    ? "bg-green-700 text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                Shop By Vehicle
              </button>
              <button
                onClick={() => setSearchTab("size")}
                className={`flex-1 py-3.5 rounded-xl text-base font-bold transition-all ${
                  searchTab === "size"
                    ? "bg-green-700 text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                Shop By Size
              </button>
            </div>
            
            {/* Vehicle Search - LARGER FIELDS */}
            {searchTab === "vehicle" && (
              <div className="space-y-3">
                <select
                  value={year}
                  onChange={(e) => { setYear(e.target.value); setMake(""); setModel(""); setTrim(""); }}
                  className="w-full h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 text-base font-medium focus:border-green-600 focus:outline-none"
                >
                  <option value="">Select Year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                
                <select
                  value={make}
                  onChange={(e) => { setMake(e.target.value); setModel(""); setTrim(""); }}
                  disabled={!year || loading === "makes"}
                  className="w-full h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 text-base font-medium focus:border-green-600 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  <option value="">{loading === "makes" ? "Loading..." : "Select Make"}</option>
                  {makes.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                
                <select
                  value={model}
                  onChange={(e) => { setModel(e.target.value); setTrim(""); }}
                  disabled={!make || loading === "models"}
                  className="w-full h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 text-base font-medium focus:border-green-600 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  <option value="">{loading === "models" ? "Loading..." : "Select Model"}</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                
                <select
                  value={trim}
                  onChange={(e) => setTrim(e.target.value)}
                  disabled={!model || loading === "trims"}
                  className="w-full h-14 rounded-xl border-2 border-neutral-200 bg-white px-4 text-base font-medium focus:border-green-600 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400"
                >
                  <option value="">{loading === "trims" ? "Loading..." : "Trim (Optional)"}</option>
                  {trims.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                
                <button
                  onClick={handleVehicleSearch}
                  disabled={!canSearchVehicle}
                  className="w-full h-16 rounded-xl bg-[#c41230] text-white font-bold text-xl hover:bg-[#a30f28] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  FIND TIRES
                </button>
              </div>
            )}
            
            {/* Size Search - LARGER FIELDS */}
            {searchTab === "size" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="h-14 rounded-xl border-2 border-neutral-200 bg-white px-3 text-base font-medium focus:border-green-600 focus:outline-none"
                  >
                    <option value="">Width</option>
                    {WIDTHS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  
                  <select
                    value={aspect}
                    onChange={(e) => setAspect(e.target.value)}
                    className="h-14 rounded-xl border-2 border-neutral-200 bg-white px-3 text-base font-medium focus:border-green-600 focus:outline-none"
                  >
                    <option value="">Aspect</option>
                    {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  
                  <select
                    value={rim}
                    onChange={(e) => setRim(e.target.value)}
                    className="h-14 rounded-xl border-2 border-neutral-200 bg-white px-3 text-base font-medium focus:border-green-600 focus:outline-none"
                  >
                    <option value="">Rim</option>
                    {RIMS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                
                <button
                  onClick={handleSizeSearch}
                  disabled={!canSearchSize}
                  className="w-full h-16 rounded-xl bg-[#c41230] text-white font-bold text-xl hover:bg-[#a30f28] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  FIND TIRES
                </button>
              </div>
            )}
            
            {/* Store info - LARGER */}
            <div className="mt-5 pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-3">
                <MapPin className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-neutral-900 truncate">{PRIMARY_STORE.address}</p>
                  <p className="text-sm text-neutral-500">{PRIMARY_STORE.city}</p>
                </div>
                <a
                  href={PRIMARY_STORE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-green-700 hover:underline"
                >
                  Directions
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          DESKTOP HERO (unchanged)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block bg-neutral-800">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2">
            <div className="px-12 py-16">
              <p className="text-sm font-bold tracking-wide text-green-500 uppercase">
                Your Local Tire Shop
              </p>
              <h1 className="mt-3 text-5xl font-bold text-white leading-tight">
                Great Tires.<br />
                Honest Prices.<br />
                Local People.
              </h1>
              <p className="mt-6 text-white/80 max-w-md">
                We're your neighbors, and we're here to help you find the right tires with expert installation and honest pricing.
              </p>
              <div className="mt-8 flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <Clock className="w-5 h-5 text-green-500" />
                  <span>Same-Day Installation</span>
                </div>
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Expert Installation</span>
                </div>
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span>Honest Pricing</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-neutral-800 to-transparent z-10 w-24" />
              <Image src="/images/homepage/storefront.jpg" alt="Warehouse Tire storefront" fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900 -z-10" />
            </div>
          </div>
        </div>
        
        {/* Desktop Search Widget */}
        <div className="relative z-20 mx-auto max-w-6xl px-4 -mb-20">
          <div className="bg-white rounded-xl shadow-xl p-6">
            <div className="flex flex-row items-end gap-6">
              <div className="flex-1">
                <div className="flex gap-1 mb-4">
                  <button onClick={() => setSearchTab("vehicle")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${searchTab === "vehicle" ? "bg-green-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                    Shop By Vehicle
                  </button>
                  <button onClick={() => setSearchTab("size")} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${searchTab === "size" ? "bg-green-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
                    Shop By Size
                  </button>
                </div>
                
                {searchTab === "vehicle" && (
                  <div>
                    <p className="text-sm text-neutral-600 mb-3">Find the right tires for your vehicle</p>
                    <div className="flex flex-wrap gap-2">
                      <select value={year} onChange={(e) => { setYear(e.target.value); setMake(""); setModel(""); setTrim(""); }} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none">
                        <option value="">Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select value={make} onChange={(e) => { setMake(e.target.value); setModel(""); setTrim(""); }} disabled={!year || loading === "makes"} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none disabled:bg-neutral-100">
                        <option value="">{loading === "makes" ? "Loading..." : "Make"}</option>
                        {makes.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select value={model} onChange={(e) => { setModel(e.target.value); setTrim(""); }} disabled={!make || loading === "models"} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none disabled:bg-neutral-100">
                        <option value="">{loading === "models" ? "Loading..." : "Model"}</option>
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select value={trim} onChange={(e) => setTrim(e.target.value)} disabled={!model || loading === "trims"} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none disabled:bg-neutral-100">
                        <option value="">{loading === "trims" ? "Loading..." : "Trim (Optional)"}</option>
                        {trims.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button onClick={handleVehicleSearch} disabled={!canSearchVehicle} className="px-6 py-2.5 rounded-lg bg-[#c41230] text-white font-bold text-sm hover:bg-[#a30f28] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors">
                        FIND TIRES
                      </button>
                    </div>
                    <p className="mt-3 text-sm text-neutral-500">Don't know your vehicle? <button onClick={() => setSearchTab("size")} className="text-green-700 hover:underline font-medium">Help me find my size</button></p>
                  </div>
                )}
                
                {searchTab === "size" && (
                  <div>
                    <p className="text-sm text-neutral-600 mb-3">Enter your tire size (found on tire sidewall)</p>
                    <div className="flex flex-wrap gap-2">
                      <select value={width} onChange={(e) => setWidth(e.target.value)} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none"><option value="">Width</option>{WIDTHS.map(w => <option key={w} value={w}>{w}</option>)}</select>
                      <select value={aspect} onChange={(e) => setAspect(e.target.value)} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none"><option value="">Aspect</option>{ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}</select>
                      <select value={rim} onChange={(e) => setRim(e.target.value)} className="flex-1 min-w-[100px] rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none"><option value="">Rim</option>{RIMS.map(r => <option key={r} value={r}>{r}</option>)}</select>
                      <button onClick={handleSizeSearch} disabled={!canSearchSize} className="px-6 py-2.5 rounded-lg bg-[#c41230] text-white font-bold text-sm hover:bg-[#a30f28] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors">FIND TIRES</button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="w-64 border-l pl-6 border-neutral-200">
                <div className="flex items-start gap-3">
                  <MapPin className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Visit Your Local Store</p>
                    <p className="mt-1 font-bold text-neutral-900">{PRIMARY_STORE.address}</p>
                    <p className="text-sm text-neutral-600">{PRIMARY_STORE.city}</p>
                    <a href={PRIMARY_STORE.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-green-700 hover:underline">Get Directions</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHY SHOP LOCAL - LARGER on mobile
// ═══════════════════════════════════════════════════════════════════════════════

function WhyShopLocal() {
  const props = [
    { icon: Users, title: "LOCAL & INDEPENDENT", description: "We live and work in this community." },
    { icon: Truck, title: "SAME-DAY INSTALL", description: "Most tires installed same day." },
    { icon: DollarSign, title: "HONEST PRICING", description: "No hidden fees. No surprises." },
    { icon: CheckCircle, title: "EXPERT INSTALL", description: "Trained technicians do it right." },
  ];

  return (
    <section className="bg-white pt-10 pb-10 lg:pt-28 lg:pb-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header - LARGER on mobile */}
        <div className="text-center mb-8 lg:mb-12">
          <p className="text-sm font-bold tracking-wide text-green-700 uppercase">
            Why Shop Local?
          </p>
          <h2 className="mt-2 text-2xl lg:text-4xl font-bold text-neutral-900 leading-tight">
            Real People. Real Service.
            <span className="block lg:inline"> Right Around the Corner.</span>
          </h2>
        </div>

        {/* Props Grid - LARGER icons and text on mobile */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-8">
          {props.map((prop) => {
            const Icon = prop.icon;
            return (
              <div key={prop.title} className="text-center">
                <div className="mx-auto w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-green-100 flex items-center justify-center mb-3 lg:mb-4">
                  <Icon className="w-7 h-7 lg:w-8 lg:h-8 text-green-700" />
                </div>
                <h3 className="font-bold text-neutral-900 text-sm lg:text-sm uppercase tracking-wide leading-tight">{prop.title}</h3>
                <p className="mt-1.5 text-sm text-neutral-600 hidden lg:block">{prop.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRAND LOGOS - LARGER on mobile
// ═══════════════════════════════════════════════════════════════════════════════

function BrandLogos() {
  return (
    <section className="bg-white py-8 lg:py-12 border-t border-neutral-200">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-sm font-bold tracking-wide text-green-700 uppercase mb-5 lg:mb-8 px-4">
          We Carry Top Tire Brands
        </p>
        
        {/* Mobile: horizontal scroll - LARGER */}
        <div className="lg:hidden overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 px-4 pb-2" style={{ width: "max-content" }}>
            {TIRE_BRANDS.map((brand) => (
              <div key={brand.name} className="flex-shrink-0 px-4 py-2.5 bg-neutral-100 rounded-xl">
                <span className="text-base font-bold text-neutral-800 whitespace-nowrap">{brand.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop */}
        <div className="hidden lg:flex flex-wrap items-center justify-center gap-8 md:gap-12 px-4">
          {TIRE_BRANDS.map((brand) => (
            <span key={brand.name} className="text-lg font-bold text-neutral-800 tracking-tight">{brand.name}</span>
          ))}
        </div>
        
        <div className="text-center mt-5 lg:mt-6">
          <Link href="/tires" className="text-sm font-semibold text-green-700 hover:underline">
            View All Brands
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL STORY - LARGER text on mobile
// ═══════════════════════════════════════════════════════════════════════════════

function LocalStory() {
  return (
    <section className="bg-green-50 py-10 lg:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-8">
          
          {/* Story - LARGER text */}
          <div>
            <p className="text-sm font-bold tracking-wide text-green-700 uppercase">
              Proud To Be Your
            </p>
            <h2 className="mt-1 text-2xl lg:text-2xl font-bold text-neutral-900">
              Neighborhood Tire Shop
            </h2>
            <p className="mt-4 text-base text-neutral-700 leading-relaxed">
              Great tires, honest prices, and friendly service you can count on.
            </p>
            <ul className="mt-5 space-y-3">
              {["Top tire brands", "Competitive prices", "Fast, professional installation", "Local and proud to serve Oakland County"].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-neutral-700">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Photo */}
          <div className="relative rounded-xl overflow-hidden h-56 lg:h-auto bg-neutral-200">
            <Image src="/images/homepage/store-interior.jpg" alt="Inside Warehouse Tire" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <div className="inline-block bg-white/95 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-sm font-bold text-green-700 uppercase">Thank You</p>
                <p className="text-sm font-bold text-neutral-900">For Supporting Local ❤️</p>
              </div>
            </div>
          </div>

          {/* Reviews - LARGER text */}
          <div>
            <p className="text-sm font-bold tracking-wide text-green-700 uppercase">
              What Our Customers Say
            </p>
            <div className="mt-3 flex gap-1 text-yellow-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <blockquote className="mt-3 text-base text-neutral-700 italic leading-relaxed">
              "Great local shop! Fast service, honest pricing, and the staff really knows their stuff."
            </blockquote>
            <p className="mt-2 text-sm text-neutral-500 font-medium">— Jason R., Pontiac</p>
            <a
              href="https://www.google.com/search?q=Warehouse+Tire+Pontiac+MI+reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-green-700 hover:underline"
            >
              Read More Reviews
            </a>
            
            {/* Mini Store Card - LARGER */}
            <div className="mt-5 bg-white rounded-xl p-4 shadow-sm border border-neutral-200">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-neutral-900 text-sm">{PRIMARY_STORE.address}</p>
                  <p className="text-sm text-neutral-600">{PRIMARY_STORE.city}</p>
                  <a href={PRIMARY_STORE.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-semibold text-green-700 hover:underline">
                    Get Directions
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSURANCE BAR - LARGER icons/text on mobile
// ═══════════════════════════════════════════════════════════════════════════════

function AssuranceBar() {
  const items = [
    { icon: DollarSign, title: "PRICE MATCH", description: "We'll match competitor prices." },
    { icon: Shield, title: "QUALITY TIRES", description: "Only brands we trust." },
    { icon: Calendar, title: "FLEXIBLE", description: "Walk-ins welcome." },
    { icon: Heart, title: "HERE FOR YOU", description: "Experts ready to help." },
  ];

  return (
    <section className="bg-green-800 py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-6">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{item.title}</div>
                  <div className="text-xs text-white/70 mt-0.5 hidden lg:block">{item.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER CONTACT - LARGER on mobile
// ═══════════════════════════════════════════════════════════════════════════════

function FooterContact() {
  return (
    <section className="bg-neutral-100 py-10 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Phone - LARGER */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <a href={`tel:${PRIMARY_STORE.phone.replace(/[^\d]/g, "")}`} className="text-xl font-bold text-neutral-900 hover:text-green-700">
                {PRIMARY_STORE.phone}
              </a>
              <p className="text-sm text-neutral-500">Call us today!</p>
            </div>
          </div>

          {/* Hours - LARGER */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <p className="font-bold text-neutral-900 text-base">MON – FRI 8AM – 5PM</p>
              <p className="text-neutral-900 text-base">SAT 8AM – 3PM</p>
              <p className="text-sm text-neutral-500">Sun: Closed</p>
            </div>
          </div>

          {/* Address - LARGER */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <p className="font-bold text-neutral-900 text-base">{PRIMARY_STORE.address}</p>
              <p className="text-neutral-900 text-base">{PRIMARY_STORE.city}</p>
              <a href={PRIMARY_STORE.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-green-700 hover:underline">
                Get Directions
              </a>
            </div>
          </div>
        </div>
        
        {/* Second store - LARGER */}
        <div className="mt-8 pt-5 border-t border-neutral-200">
          <p className="text-sm text-neutral-500 mb-3">Also visit our {STORES[1].name} location:</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-medium text-neutral-900">{STORES[1].address}, {STORES[1].city}</span>
            <a href={`tel:${STORES[1].phone.replace(/[^\d]/g, "")}`} className="font-bold text-green-700 hover:underline">
              {STORES[1].phone}
            </a>
            <a href={STORES[1].mapsUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-green-700 hover:underline">
              Get Directions
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STICKY MOBILE CTA BAR - LARGER
// ═══════════════════════════════════════════════════════════════════════════════

function MobileStickyBar() {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-2xl">
      <div className="flex">
        <a
          href={`tel:${PRIMARY_STORE.phone.replace(/[^\d]/g, "")}`}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-green-700 text-white font-bold text-base"
        >
          <Phone className="w-5 h-5" />
          Call Now
        </a>
        <a
          href={PRIMARY_STORE.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-neutral-900 text-white font-bold text-base"
        >
          <Navigation className="w-5 h-5" />
          Directions
        </a>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function LocalHomepage() {
  return (
    <div className="min-h-screen bg-white pb-16 lg:pb-0">
      <HeroSection />
      <WhyShopLocal />
      <BrandLogos />
      <LocalStory />
      <AssuranceBar />
      <FooterContact />
      <MobileStickyBar />
    </div>
  );
}
