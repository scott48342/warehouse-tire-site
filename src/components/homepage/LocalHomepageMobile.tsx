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
  Star,
  ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE-ONLY LOCAL HOMEPAGE
// ═══════════════════════════════════════════════════════════════════════════════
// Purpose-built for mobile screens. NOT a responsive desktop layout.
// Only rendered below lg breakpoint.
// ═══════════════════════════════════════════════════════════════════════════════

const STORES = [
  {
    id: "pontiac",
    name: "Pontiac",
    address: "1100 Cesar E Chavez Ave",
    city: "Pontiac, MI 48340",
    phone: "(248) 332-4120",
    phoneRaw: "2483324120",
    hours: "Mon-Fri 8AM-5PM, Sat 8AM-3PM",
    mapsUrl: "https://maps.google.com/?q=1100+Cesar+E+Chavez+Ave+Pontiac+MI+48340",
  },
  {
    id: "waterford",
    name: "Waterford",
    address: "4459 Pontiac Lake Rd",
    city: "Waterford, MI 48328",
    phone: "(248) 683-0070",
    phoneRaw: "2486830070",
    hours: "Mon-Fri 8AM-5PM, Sat 8AM-3PM",
    mapsUrl: "https://maps.google.com/?q=4459+Pontiac+Lake+Rd+Waterford+MI+48328",
  },
];

const PRIMARY_STORE = STORES[0];

const TIRE_BRANDS = ["Michelin", "BFGoodrich", "Goodyear", "Pirelli", "Continental", "Bridgestone"];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => String(THIS_YEAR - i));
const WIDTHS = [175, 185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315];
const ASPECTS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
const RIMS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 24];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LocalHomepageMobile() {
  return (
    <div className="lg:hidden bg-white">
      <HeroSection />
      <SearchCard />
      <LocalTrustSection />
      <GoogleReviewCard />
      <BrandsSection />
      <StoreInfoCard />
      <InteriorImage />
      <StickyActionBar />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. COMPACT HERO
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className="relative" style={{ minHeight: "460px" }}>
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="/images/homepage/storefront.jpg"
          alt="Warehouse Tire storefront"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 px-5 pt-8 pb-24">
        {/* Eyebrow */}
        <p className="text-base font-bold tracking-wide text-green-400 uppercase">
          Your Local Tire Shop
        </p>

        {/* Headline - 38px */}
        <h1 className="mt-4 text-[38px] leading-[1.1] font-extrabold text-white">
          Great Tires.<br />
          Installed Locally.<br />
          Today.
        </h1>

        {/* Subcopy */}
        <p className="mt-5 text-lg text-white/90 leading-relaxed max-w-[320px]">
          Shop tires online and get fast local installation in Pontiac and Waterford.
        </p>

        {/* Trust chips - stacked, not cramped */}
        <div className="mt-6 flex flex-wrap gap-3">
          {["Same-Day Install", "Honest Pricing", "Local Experts"].map((item) => (
            <div 
              key={item} 
              className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2"
            >
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-[15px] font-semibold text-white">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SEARCH CARD (overlaps hero)
// ═══════════════════════════════════════════════════════════════════════════════

function SearchCard() {
  const router = useRouter();
  const [tab, setTab] = useState<"vehicle" | "size">("vehicle");

  // Vehicle state
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);

  // Size state
  const [width, setWidth] = useState("");
  const [aspect, setAspect] = useState("");
  const [rim, setRim] = useState("");

  // Fetch makes
  useEffect(() => {
    if (!year) { setMakes([]); setMake(""); return; }
    setLoading("makes");
    fetch(`/api/vehicles/makes?year=${year}`)
      .then(r => r.json())
      .then(d => setMakes(d.results || []))
      .finally(() => setLoading(null));
  }, [year]);

  // Fetch models
  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(""); return; }
    setLoading("models");
    fetch(`/api/vehicles/models?year=${year}&make=${encodeURIComponent(make)}`)
      .then(r => r.json())
      .then(d => setModels(d.results || []))
      .finally(() => setLoading(null));
  }, [year, make]);

  // Fetch trims
  useEffect(() => {
    if (!year || !make || !model) { setTrims([]); setTrim(""); return; }
    setLoading("trims");
    fetch(`/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then(r => r.json())
      .then(d => setTrims(d.results || []))
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

  const selectClass = "w-full h-14 rounded-2xl border-2 border-neutral-200 bg-white px-4 text-[16px] font-medium focus:border-green-600 focus:outline-none disabled:bg-neutral-50 disabled:text-neutral-400 appearance-none";
  const buttonClass = "w-full h-14 rounded-2xl bg-[#c41230] text-white font-bold text-lg hover:bg-[#a30f28] disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors shadow-lg";

  return (
    <section className="px-4 -mt-16 relative z-20">
      <div className="bg-white rounded-3xl shadow-2xl p-5">
        {/* Title */}
        <h2 className="text-[22px] font-bold text-neutral-900 text-center mb-4">
          Find Tires Fast
        </h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab("vehicle")}
            className={`flex-1 py-3 rounded-xl text-[16px] font-bold transition-all ${
              tab === "vehicle" ? "bg-green-700 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Vehicle
          </button>
          <button
            onClick={() => setTab("size")}
            className={`flex-1 py-3 rounded-xl text-[16px] font-bold transition-all ${
              tab === "size" ? "bg-green-700 text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Size
          </button>
        </div>

        {/* Vehicle Search */}
        {tab === "vehicle" && (
          <div className="space-y-3">
            <select value={year} onChange={(e) => { setYear(e.target.value); setMake(""); setModel(""); setTrim(""); }} className={selectClass}>
              <option value="">Year</option>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select value={make} onChange={(e) => { setMake(e.target.value); setModel(""); setTrim(""); }} disabled={!year || loading === "makes"} className={selectClass}>
              <option value="">{loading === "makes" ? "Loading..." : "Make"}</option>
              {makes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select value={model} onChange={(e) => { setModel(e.target.value); setTrim(""); }} disabled={!make || loading === "models"} className={selectClass}>
              <option value="">{loading === "models" ? "Loading..." : "Model"}</option>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select value={trim} onChange={(e) => setTrim(e.target.value)} disabled={!model || loading === "trims"} className={selectClass}>
              <option value="">{loading === "trims" ? "Loading..." : "Trim (Optional)"}</option>
              {trims.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <button onClick={handleVehicleSearch} disabled={!canSearchVehicle} className={buttonClass}>
              Find Tires
            </button>
          </div>
        )}

        {/* Size Search */}
        {tab === "size" && (
          <div className="space-y-3">
            <select value={width} onChange={(e) => setWidth(e.target.value)} className={selectClass}>
              <option value="">Width</option>
              {WIDTHS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>

            <select value={aspect} onChange={(e) => setAspect(e.target.value)} className={selectClass}>
              <option value="">Aspect Ratio</option>
              {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            <select value={rim} onChange={(e) => setRim(e.target.value)} className={selectClass}>
              <option value="">Rim Size</option>
              {RIMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <button onClick={handleSizeSearch} disabled={!canSearchSize} className={buttonClass}>
              Find Tires
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. LOCAL TRUST SECTION - Stacked cards, NOT 4-column
// ═══════════════════════════════════════════════════════════════════════════════

function LocalTrustSection() {
  const items = [
    { 
      icon: Clock, 
      title: "Same-Day Installation", 
      description: "Most tires installed the same day you order." 
    },
    { 
      icon: CheckCircle, 
      title: "Honest Out-the-Door Pricing", 
      description: "No hidden fees. The price you see is the price you pay." 
    },
    { 
      icon: MapPin, 
      title: "Real Local Tire Shop", 
      description: "Family-owned and serving Oakland County since 1985." 
    },
    { 
      icon: Star, 
      title: "Expert Tire Installation", 
      description: "Trained technicians who care about doing it right." 
    },
  ];

  return (
    <section className="px-4 py-10">
      <h2 className="text-[24px] font-bold text-neutral-900 text-center mb-6">
        Why Shop Local?
      </h2>

      <div className="space-y-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.title} 
              className="flex items-start gap-4 bg-green-50 rounded-2xl p-5"
            >
              <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-neutral-900">{item.title}</h3>
                <p className="mt-1 text-[15px] text-neutral-600 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GOOGLE REVIEW CARD
// ═══════════════════════════════════════════════════════════════════════════════

function GoogleReviewCard() {
  return (
    <section className="px-4 pb-10">
      <div className="bg-white border-2 border-neutral-200 rounded-2xl p-6 text-center">
        <p className="text-[15px] font-semibold text-neutral-500 uppercase tracking-wide">
          Trusted by Local Drivers
        </p>

        {/* Stars */}
        <div className="flex justify-center gap-1 mt-3">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-7 h-7 text-yellow-400 fill-current" />
          ))}
        </div>

        <p className="mt-3 text-[28px] font-bold text-neutral-900">
          4.8 <span className="text-[18px] font-normal text-neutral-500">Google rating</span>
        </p>

        <p className="mt-2 text-[15px] text-neutral-600">
          Serving Pontiac, Waterford &amp; Oakland County
        </p>

        <a
          href="https://www.google.com/search?q=Warehouse+Tire+Pontiac+MI+reviews"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-[16px] font-bold text-green-700"
        >
          Read Reviews
          <ChevronRight className="w-5 h-5" />
        </a>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BRANDS SECTION - Horizontal scroll chips
// ═══════════════════════════════════════════════════════════════════════════════

function BrandsSection() {
  return (
    <section className="pb-10">
      <h3 className="text-[18px] font-bold text-neutral-900 text-center mb-4 px-4">
        Top Tire Brands In Stock
      </h3>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 px-4" style={{ width: "max-content" }}>
          {TIRE_BRANDS.map((brand) => (
            <div 
              key={brand} 
              className="flex-shrink-0 px-5 py-3 bg-neutral-100 rounded-full"
            >
              <span className="text-[16px] font-bold text-neutral-800 whitespace-nowrap">
                {brand}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-4">
        <Link href="/tires" className="text-[15px] font-semibold text-green-700">
          View All Brands →
        </Link>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. STORE INFO CARD
// ═══════════════════════════════════════════════════════════════════════════════

function StoreInfoCard() {
  return (
    <section className="px-4 pb-10">
      <div className="bg-neutral-900 rounded-2xl p-6">
        <h3 className="text-[20px] font-bold text-white">
          Warehouse Tire
        </h3>
        <p className="mt-2 text-[16px] text-white/80">
          {PRIMARY_STORE.address}<br />
          {PRIMARY_STORE.city}
        </p>
        <p className="mt-2 text-[15px] text-white/60">
          Mon-Fri 8AM-5PM • Sat 8AM-3PM
        </p>

        {/* Action buttons */}
        <div className="mt-5 flex gap-3">
          <a
            href={`tel:${PRIMARY_STORE.phoneRaw}`}
            className="flex-1 h-12 bg-green-600 rounded-xl flex items-center justify-center gap-2 text-white font-bold text-[16px]"
          >
            <Phone className="w-5 h-5" />
            Call Now
          </a>
          <a
            href={PRIMARY_STORE.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-12 bg-white rounded-xl flex items-center justify-center gap-2 text-neutral-900 font-bold text-[16px]"
          >
            <MapPin className="w-5 h-5" />
            Directions
          </a>
        </div>

        {/* Second location */}
        <div className="mt-5 pt-4 border-t border-white/20">
          <p className="text-[14px] text-white/60">Also in Waterford:</p>
          <p className="text-[15px] text-white/80">{STORES[1].address}, {STORES[1].city}</p>
          <a href={`tel:${STORES[1].phoneRaw}`} className="text-[15px] font-semibold text-green-400">
            {STORES[1].phone}
          </a>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. INTERIOR IMAGE
// ═══════════════════════════════════════════════════════════════════════════════

function InteriorImage() {
  return (
    <section className="px-4 pb-24">
      <div className="relative rounded-2xl overflow-hidden">
        <Image
          src="/images/homepage/store-interior.jpg"
          alt="Inside Warehouse Tire"
          width={800}
          height={500}
          className="w-full h-auto object-cover"
        />
      </div>
      <p className="mt-3 text-[14px] text-neutral-500 text-center px-4">
        A real local tire shop with inventory ready for installation.
      </p>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STICKY LOCAL ACTION BAR
// ═══════════════════════════════════════════════════════════════════════════════

function StickyActionBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-neutral-200 px-4 py-3 safe-area-pb">
      <div className="flex gap-3">
        <a
          href={`tel:${PRIMARY_STORE.phoneRaw}`}
          className="flex-1 h-14 bg-green-600 rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-[17px] shadow-lg"
        >
          <Phone className="w-6 h-6" />
          Call Now
        </a>
        <a
          href={PRIMARY_STORE.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-14 bg-neutral-900 rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-[17px] shadow-lg"
        >
          <MapPin className="w-6 h-6" />
          Directions
        </a>
      </div>
    </div>
  );
}
