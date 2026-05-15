"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { JakeProductCard, JakeWheelCard, ParsedProduct } from "@/components/jake/JakeProductCards";
import { ProductRail, ProductCarousel, RailProduct } from "@/components/jake/ProductRail";
import { JakeAvatar } from "@/components/jake/JakeAvatar";
import { trackGarageEvent } from "./GarageAnalytics";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE CHAT - Cinematic AI Build Studio
// 
// Goals:
// - Premium garage command center feel
// - AI-assisted build environment
// - Immersive automotive experience
// - Jake feels alive and actively assisting
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  products?: ParsedProduct[];
  wheels?: ParsedWheel[];
  cartUrl?: string;
}

interface ParsedWheel {
  brand: string;
  model: string;
  size: string;
  finish?: string;
  price: string;
  priceSet?: string;
  imageUrl?: string;
  productUrl: string;
  fitmentLabel?: string;
  inStock?: boolean;
}

interface BuildContext {
  vehicle?: string;
  goal?: string;
  category?: string;
  status: "exploring" | "tires_selected" | "wheels_selected" | "package_ready";
}

// Contextual loading messages
const LOADING_MESSAGES = [
  "Analyzing your build...",
  "Checking fitment data...",
  "Finding the best options...",
  "Building recommendations...",
  "Reviewing compatibility...",
];

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH EXPANDED PRODUCT SELECTIONS FOR RAILS
// Get more options beyond Jake's recommendations
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchExpandedTires(size: string): Promise<RailProduct[]> {
  try {
    const response = await fetch(`/api/tires/search?size=${encodeURIComponent(size)}&limit=20`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const tires = data.tires || data.results || [];
    
    return tires.slice(0, 20).map((t: any) => ({
      id: t.sku || t.partNumber || `tire-${Math.random()}`,
      type: "tire" as const,
      brand: t.brand || "",
      model: t.model || t.name || "",
      size: t.size || size,
      price: t.sellPrice ? `$${t.sellPrice.toFixed(2)}` : (t.price || ""),
      priceSet: t.setPrice ? `$${(t.setPrice).toFixed(2)}` : "",
      imageUrl: t.imageUrl || t.image,
      productUrl: t.productUrl || `/tires/${t.sku || t.partNumber}`,
      badge: t.terrain || t.category,
      fitmentBadge: t.loadRange ? `Load Range ${t.loadRange}` : undefined,
    }));
  } catch (err) {
    console.error("[Garage] fetchExpandedTires error:", err);
    return [];
  }
}

async function fetchExpandedWheels(size: string, vehicle?: string): Promise<RailProduct[]> {
  try {
    // Extract diameter from size string (e.g., "20x9" -> 20)
    const diameterMatch = size.match(/^(\d+)/);
    const diameter = diameterMatch ? diameterMatch[1] : "20";
    
    const params = new URLSearchParams({ diameter, limit: "20" });
    if (vehicle) {
      // Try to parse vehicle for fitment
      const parts = vehicle.split(" ");
      if (parts.length >= 2) {
        params.set("year", parts[0]);
        params.set("make", parts[1]);
        if (parts[2]) params.set("model", parts.slice(2).join(" "));
      }
    }
    
    const response = await fetch(`/api/wheels/search?${params.toString()}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const wheels = data.wheels || data.results || [];
    
    return wheels.slice(0, 20).map((w: any) => ({
      id: w.sku || w.partNumber || `wheel-${Math.random()}`,
      type: "wheel" as const,
      brand: w.brand || "",
      model: w.model || w.name || "",
      size: w.size || size,
      price: w.sellPrice ? `$${w.sellPrice.toFixed(2)}` : (w.price || ""),
      priceSet: w.setPrice ? `$${(w.setPrice).toFixed(2)}` : "",
      imageUrl: w.imageUrl || w.image,
      productUrl: w.productUrl || `/wheels/${w.sku || w.partNumber}`,
      badge: w.finish,
      fitmentBadge: w.fitmentConfidence,
    }));
  } catch (err) {
    console.error("[Garage] fetchExpandedWheels error:", err);
    return [];
  }
}

// Quick action categories
const QUICK_CATEGORIES = [
  { id: "quiet", label: "Quiet & Comfort", icon: "🔇" },
  { id: "aggressive", label: "Aggressive", icon: "🔥" },
  { id: "offroad", label: "Off-Road", icon: "🏔️" },
  { id: "towing", label: "Towing", icon: "🚛" },
  { id: "value", label: "Best Value", icon: "💰" },
  { id: "premium", label: "Premium", icon: "⭐" },
];

interface JakeGarageChatProps {
  initialPrompt: string | null;
  onBack: () => void;
}

export function JakeGarageChat({ initialPrompt, onBack }: JakeGarageChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [buildContext, setBuildContext] = useState<BuildContext>({ status: "exploring" });
  const [showSidePanel, setShowSidePanel] = useState(true);
  
  // Product rail state - populated based on detected intent
  const [railTires, setRailTires] = useState<RailProduct[]>([]);
  const [railWheels, setRailWheels] = useState<RailProduct[]>([]);
  const [railsMessage, setRailsMessage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProcessedInitial = useRef(false);

  // Rotate loading messages
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Process initial prompt
  useEffect(() => {
    if (initialPrompt && !hasProcessedInitial.current) {
      hasProcessedInitial.current = true;
      // Extract category from prompt if possible
      const lowerPrompt = initialPrompt.toLowerCase();
      if (lowerPrompt.includes("quiet") || lowerPrompt.includes("comfort")) {
        setBuildContext(prev => ({ ...prev, goal: "Quiet & Comfortable", category: "quiet" }));
      } else if (lowerPrompt.includes("aggressive") || lowerPrompt.includes("street")) {
        setBuildContext(prev => ({ ...prev, goal: "Aggressive Street", category: "aggressive" }));
      } else if (lowerPrompt.includes("off-road") || lowerPrompt.includes("overland")) {
        setBuildContext(prev => ({ ...prev, goal: "Off-Road Ready", category: "offroad" }));
      } else if (lowerPrompt.includes("tow") || lowerPrompt.includes("haul")) {
        setBuildContext(prev => ({ ...prev, goal: "Towing & Hauling", category: "towing" }));
      }
      handleSend(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Focus input
  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    setInput("");
    
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingMessage(LOADING_MESSAGES[0]);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://tire-fitment-ai.onrender.com/api/ai/fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text, 
          history, 
          isLocal: false,
          source: "jake_garage"
        }),
      });

      const data = await response.json();
      const responseText = data.response || "Sorry, I had trouble with that. Can you try again?";

      // Update build context from response
      if (data.vehicle) {
        setBuildContext(prev => ({ ...prev, vehicle: data.vehicle }));
        trackGarageEvent("vehicle_identified", { vehicle: data.vehicle });
      }

      // Parse products
      let products: ParsedProduct[] = [];
      let wheels: ParsedWheel[] = [];
      
      if (data.products?.tires?.length > 0) {
        products = data.products.tires.map((t: any) => ({
          type: "tire" as const,
          name: `${t.brand} ${t.model}`,
          brand: t.brand,
          model: t.model,
          price: t.price || t.priceEach,
          priceNum: t.priceNum || parseFloat(String(t.price || "0").replace(/[$,]/g, "")),
          warranty: t.warrantyMiles ? `${Number(t.warrantyMiles).toLocaleString()} miles` : t.warranty,
          size: t.size,
          terrain: t.terrain,
          loadRange: t.loadRange,
          imageUrl: t.imageUrl,
          productUrl: t.productUrl,
          inStock: t.inStock !== false,
          setPrice: t.priceSet,
          recommendationBadge: t.recommendationBadge,
        }));
        setBuildContext(prev => ({ ...prev, status: "tires_selected" }));
        trackGarageEvent("recommendation_shown", { type: "tires", count: products.length });
      }

      if (data.products?.wheels?.length > 0) {
        wheels = data.products.wheels.map((w: any) => ({
          brand: w.brand,
          model: w.model || w.name,
          size: w.size,
          finish: w.finish,
          price: w.price || w.priceEach,
          priceSet: w.priceSet,
          imageUrl: w.imageUrl,
          productUrl: w.productUrl,
          fitmentLabel: w.fitmentConfidence,
          inStock: w.inStock !== false,
        }));
        setBuildContext(prev => ({ ...prev, status: "wheels_selected" }));
        trackGarageEvent("recommendation_shown", { type: "wheels", count: wheels.length });
      }

      const cartUrl = data.cartUrl || parseCartUrl(responseText);
      if (cartUrl) {
        setBuildContext(prev => ({ ...prev, status: "package_ready" }));
        trackGarageEvent("cart_created", { cartUrl: cartUrl.slice(0, 100) });
      }

      // ═══════════════════════════════════════════════════════════════════════
      // POPULATE PRODUCT RAILS WITH EXPANDED SELECTION
      // Fetch MORE products beyond Jake's recommendations for the rails
      // ═══════════════════════════════════════════════════════════════════════
      
      const hasTireData = products.length > 0 || data.products?.tires?.length > 0 || data.products?.staggeredPairs?.length > 0;
      const hasWheelData = wheels.length > 0 || data.products?.wheels?.length > 0;
      
      // Extract tire size from Jake's response to fetch more options
      if (hasTireData) {
        const tireSource = data.products?.tires || data.products?.staggeredPairs || products;
        const detectedSize = tireSource[0]?.size || data.searchParams?.size;
        
        if (detectedSize) {
          // Fetch expanded tire selection for the rail (don't await - let it load async)
          fetchExpandedTires(detectedSize).then(expandedTires => {
            if (expandedTires.length > 0) {
              setRailTires(expandedTires);
            }
          }).catch(err => {
            console.error("[Garage] Failed to fetch expanded tires:", err);
            // Fall back to Jake's recommendations
            const railTireData: RailProduct[] = tireSource.slice(0, 12).map((t: any) => ({
              id: t.sku || t.productUrl || `tire-${Math.random()}`,
              type: "tire" as const,
              brand: t.brand || "",
              model: t.model || t.name || "",
              size: t.size || "",
              price: typeof t.price === "string" ? t.price : (t.priceEach ? `$${t.priceEach}` : ""),
              priceSet: typeof t.setPrice === "string" ? t.setPrice : (t.priceSet ? `$${t.priceSet}` : ""),
              imageUrl: t.imageUrl,
              badge: t.terrain || t.badge,
              fitmentBadge: t.loadRange ? `Load Range ${t.loadRange}` : undefined,
            }));
            setRailTires(railTireData);
          });
          
          // Set initial rails with Jake's picks while expanded loads
          const initialRailData: RailProduct[] = tireSource.slice(0, 6).map((t: any) => ({
            id: t.sku || t.productUrl || `tire-${Math.random()}`,
            type: "tire" as const,
            brand: t.brand || "",
            model: t.model || t.name || "",
            size: t.size || "",
            price: typeof t.price === "string" ? t.price : (t.priceEach ? `$${t.priceEach}` : ""),
            priceSet: typeof t.setPrice === "string" ? t.setPrice : (t.priceSet ? `$${t.priceSet}` : ""),
            imageUrl: t.imageUrl,
            badge: t.terrain || t.badge,
            fitmentBadge: t.loadRange ? `Load Range ${t.loadRange}` : undefined,
          }));
          setRailTires(initialRailData);
        }
      }
      
      // Extract wheel size/specs to fetch more wheel options
      if (hasWheelData) {
        const wheelSource = data.products?.wheels || wheels;
        const detectedWheelSize = wheelSource[0]?.size || data.searchParams?.wheelSize;
        
        if (detectedWheelSize) {
          // Fetch expanded wheel selection for the rail
          fetchExpandedWheels(detectedWheelSize, data.vehicle).then(expandedWheels => {
            if (expandedWheels.length > 0) {
              setRailWheels(expandedWheels);
            }
          }).catch(err => {
            console.error("[Garage] Failed to fetch expanded wheels:", err);
            // Fall back to Jake's recommendations
            const railWheelData: RailProduct[] = wheelSource.slice(0, 12).map((w: any) => ({
              id: w.sku || w.productUrl || `wheel-${Math.random()}`,
              type: "wheel" as const,
              brand: w.brand || "",
              model: w.model || w.name || "",
              size: w.size || "",
              price: typeof w.price === "string" ? w.price : (w.priceEach ? `$${w.priceEach}` : ""),
              priceSet: typeof w.setPrice === "string" ? w.setPrice : (w.priceSet ? `$${w.priceSet}` : ""),
              imageUrl: w.imageUrl,
              badge: w.finish || w.badge,
              fitmentBadge: w.fitmentConfidence || w.fitmentLabel,
            }));
            setRailWheels(railWheelData);
          });
          
          // Set initial rails with Jake's picks while expanded loads
          const initialWheelData: RailProduct[] = wheelSource.slice(0, 6).map((w: any) => ({
            id: w.sku || w.productUrl || `wheel-${Math.random()}`,
            type: "wheel" as const,
            brand: w.brand || "",
            model: w.model || w.name || "",
            size: w.size || "",
            price: typeof w.price === "string" ? w.price : (w.priceEach ? `$${w.priceEach}` : ""),
            priceSet: typeof w.setPrice === "string" ? w.setPrice : (w.priceSet ? `$${w.priceSet}` : ""),
            imageUrl: w.imageUrl,
            badge: w.finish || w.badge,
            fitmentBadge: w.fitmentConfidence || w.fitmentLabel,
          }));
          setRailWheels(initialWheelData);
        }
      }
      
      // Set Jake's message about the rails
      if (hasTireData && hasWheelData) {
        setRailsMessage("I've got some options for you! Click any product to learn more.");
      } else if (hasTireData) {
        setRailsMessage("Here are some tire options. Click any one to learn more!");
      } else if (hasWheelData) {
        setRailsMessage("Check out these wheels! Click any one for details.");
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        products: products.length > 0 ? products : undefined,
        wheels: wheels.length > 0 ? wheels : undefined,
        cartUrl,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Jake Garage error:", error);
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Try again in a sec.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseCartUrl = (text: string): string | undefined => {
    const match = text.match(/https:\/\/shop\.warehousetiredirect\.com\/cart\/prefill\?data=[^\s)]+/);
    return match?.[0];
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickCategory = (category: typeof QUICK_CATEGORIES[0]) => {
    setBuildContext(prev => ({ ...prev, goal: category.label, category: category.id }));
    handleSend(`I'm looking for ${category.label.toLowerCase()} options`);
  };

  // Handle rail product click - inject into chat
  const handleRailClick = (product: RailProduct) => {
    const productDesc = `Tell me about the ${product.brand} ${product.model}`;
    handleSend(productDesc);
  };

  // Determine which rails to show
  const showLeftRail = railTires.length > 0 || railWheels.length > 0;
  const showRightRail = railTires.length > 0 && railWheels.length > 0;
  
  // Left rail shows tires (or wheels if no tires)
  const leftRailProducts = railTires.length > 0 ? railTires : railWheels;
  const leftRailTitle = railTires.length > 0 ? "Tire Options" : "Wheel Options";
  
  // Right rail shows wheels (only if we have both)
  const rightRailProducts = railTires.length > 0 && railWheels.length > 0 ? railWheels : [];
  const rightRailTitle = "Wheel Options";

  return (
    <div className="flex h-screen overflow-hidden bg-[#030303]">
      {/* ═══════════════════════════════════════════════════════════════════════
          CINEMATIC BACKGROUND - Visible Garage Environment
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        
        {/* Main garage background - VISIBLE */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/garage/misc-wheel-wall.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) brightness(0.7)',
            transform: 'scale(1.05)',
          }}
        />
        
        {/* Right side garage overlay */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-[60%]"
          style={{
            backgroundImage: 'url(/garage/hero-garage-04.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'right center',
            filter: 'blur(6px) brightness(0.65)',
          }}
        />

        {/* Light center darkening for readability - minimal */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-black/30" />
        
        {/* Subtle edge vignette */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 40% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)',
          }}
        />

        {/* Red accent glow - bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-red-900/15 to-transparent" />
        
        {/* Header blend - lighter */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA WITH PRODUCT RAILS
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className={`relative flex flex-1 ${showSidePanel ? 'lg:mr-[340px]' : ''}`}>
        
        {/* Left Product Rail - Desktop (only when we have products) */}
        {showLeftRail && (
          <ProductRail
            products={leftRailProducts}
            side="left"
            title={leftRailTitle}
            onProductClick={handleRailClick}
            paused={isLoading}
          />
        )}

        {/* Main Chat Column */}
        <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Mobile Product Carousel (only when we have products) */}
        {showLeftRail && (
          <ProductCarousel
            products={leftRailProducts}
            onProductClick={handleRailClick}
          />
        )}

        {/* Header */}
        <header className="relative z-20 flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-black/60 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-red-500/30">
                <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
              </div>
              <div>
                <h1 className="text-white font-bold flex items-center gap-2">
                  Jake
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </h1>
                <p className="text-white/50 text-xs">
                  {isLoading ? loadingMessage : "AI Build Advisor"}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle side panel on desktop */}
            <button
              onClick={() => setShowSidePanel(!showSidePanel)}
              className="hidden lg:flex p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              title={showSidePanel ? "Hide panel" : "Show panel"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
          </div>
        </header>

        {/* Jake's hint about product rails - shown when rails appear */}
        {showLeftRail && railsMessage && (
          <div className="relative z-10 px-4 py-3 bg-gradient-to-r from-red-900/20 via-red-900/10 to-red-900/20 border-b border-red-500/20">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <JakeAvatar size="sm" />
              <p className="text-white/80 text-sm">
                {railsMessage}
              </p>
              <button 
                onClick={() => setRailsMessage(null)}
                className="ml-auto text-white/40 hover:text-white/60 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Messages Area with Environmental Depth */}
        <div className="relative flex-1 overflow-y-auto px-4 md:px-6 py-6">
          {/* Conversation area glow - follows scroll */}
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="sticky top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-30"
              style={{
                background: 'radial-gradient(ellipse, rgba(220,38,38,0.1) 0%, transparent 70%)',
              }}
            />
          </div>
          <div className="relative max-w-2xl mx-auto space-y-6">
            
            {/* Welcome state if no messages */}
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-12 animate-fade-in">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
                  <Image
                    src="/jake/jake-explaining.png"
                    alt="Jake"
                    fill
                    className="object-contain relative"
                  />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Let's Build Something</h2>
                <p className="text-white/50 mb-8 max-w-md mx-auto">
                  Tell me what you drive, or pick a build style below. I'll find the perfect setup.
                </p>
                
                {/* Quick Categories */}
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleQuickCategory(cat)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-xl text-white/70 hover:text-white text-sm transition-all duration-300 hover:scale-105"
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message, idx) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* User Message - Premium with glow */}
                {message.role === "user" && (
                  <div className="max-w-[85%] md:max-w-[70%]">
                    <div className="relative">
                      {/* Subtle glow behind */}
                      <div className="absolute -inset-1 bg-red-500/20 rounded-2xl blur-xl" />
                      <div className="relative bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl rounded-br-md px-5 py-3.5 shadow-2xl shadow-red-900/30 border border-red-500/20">
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Assistant Message - Premium Glassmorphism */}
                {message.role === "assistant" && (
                  <div className="max-w-[90%] md:max-w-[80%]">
                    <div className="flex items-start gap-3">
                      {/* Jake Avatar with glow */}
                      <div className="flex-shrink-0 relative">
                        <div className="absolute -inset-1 bg-red-500/20 rounded-full blur-md" />
                        <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg">
                          <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* Message Bubble - Enhanced Glassmorphism */}
                        <div className="relative group">
                          {/* Outer glow on hover */}
                          <div className="absolute -inset-1 bg-white/[0.02] rounded-2xl blur-lg group-hover:bg-white/[0.04] transition-all duration-500" />
                          {/* Main bubble */}
                          <div className="relative bg-white/[0.06] backdrop-blur-2xl rounded-2xl rounded-tl-md px-5 py-4 border border-white/[0.08] shadow-2xl shadow-black/40">
                            {/* Top edge highlight */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
                            {/* Inner glow gradient */}
                            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
                            {/* Left edge accent */}
                            <div className="absolute left-0 top-4 bottom-4 w-px bg-gradient-to-b from-red-500/30 via-red-500/10 to-transparent" />
                            <p className="relative text-white/90 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                        
                        {/* Product Cards */}
                        {message.products && message.products.length > 0 && (
                          <div className="mt-4 space-y-3">
                            {message.products.map((product, idx) => (
                              <JakeProductCard key={idx} product={product} />
                            ))}
                          </div>
                        )}
                        
                        {/* Wheel Cards */}
                        {message.wheels && message.wheels.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {message.wheels.map((wheel, idx) => (
                              <JakeWheelCard key={idx} wheel={wheel} />
                            ))}
                          </div>
                        )}
                        
                        {/* Cart CTA */}
                        {message.cartUrl && (
                          <div className="mt-4">
                            <a
                              href={message.cartUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => trackGarageEvent("checkout_started", { cartUrl: message.cartUrl })}
                              className="inline-flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-green-500/30 hover:scale-105"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              View Cart & Checkout
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading Indicator - Jake Thinking with Premium Styling */}
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-start gap-3">
                  {/* Jake Avatar with active glow */}
                  <div className="flex-shrink-0 relative">
                    <div className="absolute -inset-1.5 bg-red-500/30 rounded-full blur-md animate-pulse" />
                    <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-red-500/40 shadow-lg shadow-red-500/20">
                      <Image src="/jake/jake-thinking.png" alt="Jake thinking" fill className="object-cover" />
                    </div>
                  </div>
                  {/* Loading bubble */}
                  <div className="relative">
                    <div className="absolute -inset-1 bg-red-500/10 rounded-2xl blur-lg animate-pulse" />
                    <div className="relative bg-white/[0.06] backdrop-blur-2xl rounded-2xl rounded-tl-md px-5 py-4 border border-white/[0.08] shadow-2xl shadow-black/40">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce shadow-sm shadow-red-500/50" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce shadow-sm shadow-red-500/50" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce shadow-sm shadow-red-500/50" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-white/60 text-sm">{loadingMessage}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="relative z-20 flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/10 bg-black/60 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto">
            {/* Quick prompts when conversation started */}
            {messages.length > 0 && messages.length < 4 && !isLoading && (
              <div className="flex flex-wrap gap-2 mb-3">
                {["Show me options", "What about wheels?", "Build a package"].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/60 hover:text-white transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
            
            <div className="relative">
              {/* Input glow on focus */}
              <div className="absolute -inset-1 bg-red-500/20 rounded-2xl blur-xl opacity-0 focus-within:opacity-100 transition-opacity pointer-events-none" />
              
              <div className="relative flex items-center gap-3 bg-white/[0.05] backdrop-blur-xl border border-white/10 rounded-2xl px-4 focus-within:border-red-500/40 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell Jake what you're looking for..."
                  disabled={isLoading}
                  className="flex-1 bg-transparent py-4 text-white placeholder-white/40 focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/20 text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/30"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        </div> {/* End Main Chat Column */}

        {/* Right Product Rail - Desktop (only when we have both tires AND wheels) */}
        {showRightRail && (
          <ProductRail
            products={rightRailProducts}
            side="right"
            title={rightRailTitle}
            onProductClick={handleRailClick}
            paused={isLoading}
          />
        )}
      </div> {/* End Main Content Area with Rails */}

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT SIDE PANEL - Jake's Build Workspace (Desktop Only)
      ═══════════════════════════════════════════════════════════════════════ */}
      {showSidePanel && (
        <aside className="hidden lg:flex flex-col fixed right-0 top-0 bottom-0 w-[340px] bg-black/80 backdrop-blur-xl border-l border-white/10 z-30">
          
          {/* Jake Card */}
          <div className="p-6 border-b border-white/10">
            <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl p-5 border border-white/10">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-red-500/10 rounded-2xl blur-xl pointer-events-none" />
              
              <div className="relative flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden ring-2 ring-red-500/30">
                  <Image
                    src={isLoading ? "/jake/jake-thinking.png" : "/jake/jake-explaining.png"}
                    alt="Jake"
                    fill
                    className="object-cover"
                  />
                  {/* Online indicator */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-black flex items-center justify-center">
                    <span className="w-2 h-2 bg-green-300 rounded-full animate-ping" />
                  </div>
                </div>
                <div>
                  <p className="text-red-500 text-xs font-semibold uppercase tracking-wider">AI Advisor</p>
                  <h3 className="text-xl font-black text-white">Jake</h3>
                  <p className="text-white/50 text-xs">
                    {isLoading ? "Working on it..." : "Ready to help"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Build Status */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Current Build */}
            <div>
              <h4 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Current Build</h4>
              <div className="space-y-3">
                {/* Vehicle */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">Vehicle</span>
                    {buildContext.vehicle ? (
                      <span className="text-white font-medium text-sm">{buildContext.vehicle}</span>
                    ) : (
                      <span className="text-white/30 text-sm italic">Not set</span>
                    )}
                  </div>
                </div>
                
                {/* Goal */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">Build Goal</span>
                    {buildContext.goal ? (
                      <span className="text-red-400 font-medium text-sm">{buildContext.goal}</span>
                    ) : (
                      <span className="text-white/30 text-sm italic">Exploring</span>
                    )}
                  </div>
                </div>
                
                {/* Status */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">Status</span>
                    <span className={`text-sm font-medium ${
                      buildContext.status === "package_ready" ? "text-green-400" :
                      buildContext.status === "wheels_selected" ? "text-blue-400" :
                      buildContext.status === "tires_selected" ? "text-amber-400" :
                      "text-white/50"
                    }`}>
                      {buildContext.status === "package_ready" ? "✓ Package Ready" :
                       buildContext.status === "wheels_selected" ? "Wheels Selected" :
                       buildContext.status === "tires_selected" ? "Tires Selected" :
                       "Exploring"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h4 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_CATEGORIES.slice(0, 4).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleQuickCategory(cat)}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-red-500/20 rounded-xl text-white/60 hover:text-white text-xs transition-all disabled:opacity-50"
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trust Badges */}
            <div className="pt-4 border-t border-white/5">
              <div className="space-y-3">
                {[
                  { icon: "✓", text: "Fitment Guaranteed" },
                  { icon: "🚚", text: "Free Shipping $199+" },
                  { icon: "💬", text: "Expert Support" },
                ].map((badge, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-white/40 text-xs">
                    <span className="text-red-500">{badge.icon}</span>
                    <span>{badge.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-black/50">
            <a
              href="https://shop.warehousetiredirect.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Powered by <span className="font-semibold text-white/60">WTD</span>
            </a>
          </div>
        </aside>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CSS ANIMATIONS
      ═══════════════════════════════════════════════════════════════════════ */}
      <style jsx>{`
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
