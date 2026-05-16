"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { JakeProductCard, JakeWheelCard, ParsedProduct } from "@/components/jake/JakeProductCards";
import { ProductRail, ProductCarousel, RailProduct } from "@/components/jake/ProductRail";
import { JakeAvatar } from "@/components/jake/JakeAvatar";
import { trackGarageEvent } from "./GarageAnalytics";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE CHAT - Intelligent Build Studio
// 
// Phase 2 Features:
// - Product Injection into conversation
// - Live Build State Tracking
// - Jake Intelligence/Guidance Layer
// - Save & Resume Build System
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string;
  role: "user" | "assistant" | "product-injection";
  content: string;
  timestamp: Date;
  products?: ParsedProduct[];
  wheels?: ParsedWheel[];
  cartUrl?: string;
  injectedProduct?: SelectedProduct; // For product injection messages
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

// Selected product for build tracking
interface SelectedProduct {
  id: string;
  type: "tire" | "wheel" | "package";
  brand: string;
  model: string;
  size: string;
  price: string;
  priceNum?: number;
  imageUrl?: string;
  productUrl?: string;
  finish?: string;
  category?: string;
  specs?: {
    boltPattern?: string;
    offset?: string;
    warranty?: string;
    loadRange?: string;
    terrain?: string;
  };
}

// Build profile types
type BuildProfile = 
  | "budget"      // Budget-focused
  | "daily"       // Quiet daily driver
  | "aggressive"  // Aggressive street/stance
  | "offroad"     // Off-road/lifted
  | "towing"      // Towing/hauling
  | "performance" // Performance/track
  | "luxury"      // Luxury/blackout
  | "winter"      // Winter/all-weather
  | "unsure";     // Unsure/overwhelmed

const PROFILE_LABELS: Record<BuildProfile, string> = {
  budget: "💰 Budget-Focused",
  daily: "🔇 Daily Driver",
  aggressive: "🔥 Aggressive Street",
  offroad: "🏔️ Off-Road Build",
  towing: "🚛 Towing/Hauling",
  performance: "🏎️ Performance",
  luxury: "✨ Luxury/Blackout",
  winter: "❄️ Winter-Ready",
  unsure: "🤔 Exploring Options",
};

// Detect build profile from conversation text
function detectBuildProfile(text: string): BuildProfile | null {
  const lower = text.toLowerCase();
  
  // Budget signals
  if (/cheap|affordable|budget|tight budget|save money|don't want to spend|low cost|inexpensive/.test(lower)) {
    return "budget";
  }
  
  // Towing signals (check before daily since towing is more specific)
  if (/tow|towing|haul|hauling|camper|trailer|boat|5th wheel|heavy load|work truck|payload/.test(lower)) {
    return "towing";
  }
  
  // Off-road signals
  if (/off-?road|trail|mud|lift|lifted|35s|37s|wheeling|overland|crawl/.test(lower)) {
    return "offroad";
  }
  
  // Performance signals
  if (/track|grip|handling|autocross|performance|corner|summer tire|racing|fast/.test(lower)) {
    return "performance";
  }
  
  // Aggressive/stance signals
  if (/aggressive|stance|poke|flush|tucked|concave|fitment|wheel game|mean|sick/.test(lower)) {
    return "aggressive";
  }
  
  // Winter signals
  if (/snow|winter|ice|michigan|minnesota|3-peak|all-weather|cold|blizzard/.test(lower)) {
    return "winter";
  }
  
  // Luxury signals
  if (/blackout|murdered|clean look|luxury|classy|oem\+|subtle|sophisticated|elegant/.test(lower)) {
    return "luxury";
  }
  
  // Daily driver signals
  if (/quiet|smooth ride|daily|highway|commute|comfort|road noise|long drive/.test(lower)) {
    return "daily";
  }
  
  // Unsure signals
  if (/don't know|confused|overwhelm|help me|not sure|what do you recommend|just need/.test(lower)) {
    return "unsure";
  }
  
  return null;
}

// Enhanced build context with full state tracking
interface BuildContext {
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
    fullName?: string;
  };
  goal?: string;
  category?: string;
  buildProfile?: BuildProfile; // Detected customer profile
  status: "exploring" | "browsing" | "tires_selected" | "wheels_selected" | "package_ready";
  selectedTires?: SelectedProduct[];
  selectedWheels?: SelectedProduct[];
  consideringProduct?: SelectedProduct;
  fitmentVerified?: boolean;
  tireSize?: string;
  wheelSize?: string;
  buildId?: string; // For save/resume
  savedAt?: number;
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
    const sizeMatch = size.match(/(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)/);
    const diameter = sizeMatch ? sizeMatch[1] : "20";
    const width = sizeMatch ? sizeMatch[2] : undefined;
    
    const params = new URLSearchParams({ diameter, pageSize: "24" });
    if (width) params.set("width", width);
    
    const numWidth = width ? parseFloat(width) : 0;
    const numDiameter = parseFloat(diameter);
    if (numWidth >= 10 || numDiameter >= 20) {
      params.set("includeLifted", "true");
      params.set("offsetMin", "-76");
      params.set("offsetMax", "0");
    }
    
    if (vehicle) {
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
    const wheels = data.wheels || data.styles || data.results || [];
    
    return wheels.slice(0, 24).map((w: any) => ({
      id: w.sku || w.styleKey || w.partNumber || `wheel-${Math.random()}`,
      type: "wheel" as const,
      brand: w.brand || "",
      model: w.model || w.styleName || w.name || "",
      size: w.size || `${w.diameter || diameter}x${w.width || width || "?"}`,
      price: w.sellPrice ? `$${w.sellPrice.toFixed(2)}` : (w.price ? `$${w.price}` : ""),
      priceSet: w.setPrice ? `$${(w.setPrice).toFixed(2)}` : "",
      imageUrl: w.imageUrl || w.image || w.finishes?.[0]?.imageUrl,
      productUrl: w.productUrl || `/wheels/${w.sku || w.styleKey || w.partNumber}`,
      badge: w.finish || w.finishes?.[0]?.finish,
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

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE HELPERS - Save & Resume Build
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "jake_garage_build";

function saveBuild(context: BuildContext, messages: Message[]): string {
  const buildId = context.buildId || `build_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const buildData = {
    buildId,
    context: { ...context, buildId, savedAt: Date.now() },
    messages: messages.map(m => ({
      ...m,
      // Don't persist cart URLs (security)
      cartUrl: undefined,
    })),
    version: 1,
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildData));
    console.log("[Garage] Build saved:", buildId);
  } catch (err) {
    console.error("[Garage] Failed to save build:", err);
  }
  
  return buildId;
}

function loadBuild(): { context: BuildContext; messages: Message[] } | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const data = JSON.parse(saved);
    // Don't restore builds older than 48 hours
    if (data.context?.savedAt && Date.now() - data.context.savedAt > 48 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return {
      context: data.context,
      messages: data.messages?.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })) || [],
    };
  } catch (err) {
    console.error("[Garage] Failed to load build:", err);
    return null;
  }
}

function clearSavedBuild() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("[Garage] Failed to clear build:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

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
  
  // Product rail state
  const [railTires, setRailTires] = useState<RailProduct[]>([]);
  const [railWheels, setRailWheels] = useState<RailProduct[]>([]);
  const [railsMessage, setRailsMessage] = useState<string | null>(null);
  
  // Product injection state
  const [highlightedProduct, setHighlightedProduct] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedBuildData, setSavedBuildData] = useState<{ context: BuildContext; messages: Message[] } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProcessedInitial = useRef(false);
  const hasCheckedSavedBuild = useRef(false);

  // Check for saved build on mount
  useEffect(() => {
    if (hasCheckedSavedBuild.current) return;
    hasCheckedSavedBuild.current = true;
    
    const saved = loadBuild();
    if (saved && saved.messages.length > 0) {
      setSavedBuildData(saved);
      setShowResumePrompt(true);
    }
  }, []);

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
    if (initialPrompt && !hasProcessedInitial.current && !showResumePrompt) {
      hasProcessedInitial.current = true;
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
  }, [initialPrompt, showResumePrompt]);

  // Focus input
  useEffect(() => {
    if (!isLoading && !showResumePrompt) inputRef.current?.focus();
  }, [isLoading, showResumePrompt]);

  // Auto-save build periodically
  useEffect(() => {
    if (messages.length === 0) return;
    const timeout = setTimeout(() => {
      saveBuild(buildContext, messages);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [messages, buildContext]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUME BUILD HANDLER
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleResumeBuild = () => {
    if (savedBuildData) {
      setMessages(savedBuildData.messages);
      setBuildContext(savedBuildData.context);
      setShowResumePrompt(false);
      trackGarageEvent("build_resumed", { buildId: savedBuildData.context.buildId });
    }
  };

  const handleStartFresh = () => {
    clearSavedBuild();
    setSavedBuildData(null);
    setShowResumePrompt(false);
    if (initialPrompt) {
      hasProcessedInitial.current = false; // Allow initial prompt to process
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT INJECTION HANDLER - The WOW Feature
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleProductInjection = async (product: RailProduct) => {
    // Visual feedback - highlight the product
    setHighlightedProduct(product.id);
    setTimeout(() => setHighlightedProduct(null), 1500);
    
    // Create selected product object with full context
    const selectedProduct: SelectedProduct = {
      id: product.id,
      type: product.type,
      brand: product.brand,
      model: product.model,
      size: product.size,
      price: product.price,
      priceNum: parseFloat(product.price.replace(/[$,]/g, "")) || undefined,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      finish: product.badge,
      category: product.fitmentBadge,
    };
    
    // Update build context - track what they're considering
    setBuildContext(prev => ({
      ...prev,
      consideringProduct: selectedProduct,
      status: prev.status === "exploring" ? "browsing" : prev.status,
    }));
    
    // Inject product card into conversation
    const injectionMessage: Message = {
      id: generateId(),
      role: "product-injection",
      content: `Selected: ${product.brand} ${product.model}`,
      timestamp: new Date(),
      injectedProduct: selectedProduct,
    };
    setMessages(prev => [...prev, injectionMessage]);
    
    trackGarageEvent("product_injected", { 
      productId: product.id, 
      type: product.type,
      brand: product.brand,
      model: product.model,
    });
    
    // Now ask Jake about this specific product with full context
    await handleSendWithProductContext(selectedProduct);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND WITH PRODUCT CONTEXT - Jake Intelligence Layer
  // ═══════════════════════════════════════════════════════════════════════════
  
  const handleSendWithProductContext = async (product: SelectedProduct) => {
    setIsLoading(true);
    setLoadingMessage("Analyzing this option...");
    
    try {
      const history = messages
        .filter(m => m.role !== "product-injection")
        .map(m => ({ role: m.role, content: m.content }));
      
      // Build a rich context prompt for Jake
      const contextPrompt = buildProductContextPrompt(product, buildContext);
      
      const response = await fetch("https://tire-fitment-ai.onrender.com/api/ai/fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: contextPrompt,
          history, 
          isLocal: false,
          source: "jake_garage",
          // Pass product context directly to the AI
          productContext: {
            selectedProduct: product,
            vehicle: buildContext.vehicle,
            goal: buildContext.goal,
            previousSelections: {
              tires: buildContext.selectedTires,
              wheels: buildContext.selectedWheels,
            },
          },
        }),
      });

      const data = await response.json();
      const responseText = data.response || "Let me tell you about that option...";

      // Update vehicle if detected
      if (data.vehicle) {
        setBuildContext(prev => ({ 
          ...prev, 
          vehicle: {
            fullName: data.vehicle,
            ...parseVehicle(data.vehicle),
          },
        }));
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Jake Garage error:", error);
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "I'm having trouble analyzing that right now. Can you try again?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Build context-aware prompt for Jake
  const buildProductContextPrompt = (product: SelectedProduct, context: BuildContext): string => {
    const parts: string[] = [];
    
    parts.push(`The customer clicked on this ${product.type}: ${product.brand} ${product.model}`);
    parts.push(`Size: ${product.size}, Price: ${product.price}`);
    
    if (product.finish) parts.push(`Finish: ${product.finish}`);
    
    if (context.vehicle?.fullName) {
      parts.push(`Their vehicle: ${context.vehicle.fullName}`);
    }
    
    if (context.goal) {
      parts.push(`Build goal: ${context.goal}`);
    }
    
    if (context.selectedTires?.length) {
      parts.push(`Already selected tires: ${context.selectedTires.map(t => `${t.brand} ${t.model}`).join(", ")}`);
    }
    
    if (context.selectedWheels?.length) {
      parts.push(`Already selected wheels: ${context.selectedWheels.map(w => `${w.brand} ${w.model}`).join(", ")}`);
    }
    
    parts.push("");
    parts.push("Tell them about this specific product - why it's good (or not ideal) for their build. Be specific about:");
    parts.push("- Why it fits their vehicle/goals");
    parts.push("- Pros and cons for their use case");
    parts.push("- How it compares to alternatives");
    parts.push("- What it would pair well with");
    parts.push("Keep it conversational and helpful like a real advisor.");
    
    return parts.join("\n");
  };

  // Parse vehicle string into parts
  const parseVehicle = (vehicleStr: string): Partial<BuildContext["vehicle"]> => {
    const parts = vehicleStr.split(" ");
    if (parts.length >= 3) {
      return {
        year: parts[0],
        make: parts[1],
        model: parts.slice(2).join(" "),
      };
    }
    return {};
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SEND HANDLER
  // ═══════════════════════════════════════════════════════════════════════════

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
    
    // Detect build profile from user message
    const detectedProfile = detectBuildProfile(text);
    if (detectedProfile && !buildContext.buildProfile) {
      setBuildContext(prev => ({ ...prev, buildProfile: detectedProfile }));
      trackGarageEvent("profile_detected", { profile: detectedProfile });
    }
    
    setIsLoading(true);
    setLoadingMessage(LOADING_MESSAGES[0]);

    try {
      const history = messages
        .filter(m => m.role !== "product-injection")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://tire-fitment-ai.onrender.com/api/ai/fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text, 
          history, 
          isLocal: false,
          source: "jake_garage",
          buildContext: {
            vehicle: buildContext.vehicle,
            goal: buildContext.goal,
            buildProfile: detectedProfile || buildContext.buildProfile,
            selectedTires: buildContext.selectedTires,
            selectedWheels: buildContext.selectedWheels,
          },
        }),
      });

      const data = await response.json();
      const responseText = data.response || "Sorry, I had trouble with that. Can you try again?";

      // Update build context from response
      if (data.vehicle) {
        setBuildContext(prev => ({ 
          ...prev, 
          vehicle: {
            fullName: data.vehicle,
            ...parseVehicle(data.vehicle),
          },
        }));
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
        setBuildContext(prev => ({ ...prev, status: "tires_selected", tireSize: data.products.tires[0]?.size }));
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
        setBuildContext(prev => ({ ...prev, status: "wheels_selected", wheelSize: data.products.wheels[0]?.size }));
        trackGarageEvent("recommendation_shown", { type: "wheels", count: wheels.length });
      }

      const cartUrl = data.cartUrl || parseCartUrl(responseText);
      if (cartUrl) {
        setBuildContext(prev => ({ ...prev, status: "package_ready" }));
        trackGarageEvent("cart_created", { cartUrl: cartUrl.slice(0, 100) });
      }

      // Populate product rails
      const hasTireData = products.length > 0 || data.products?.tires?.length > 0;
      const hasWheelData = wheels.length > 0 || data.products?.wheels?.length > 0;
      
      if (hasTireData) {
        const tireSource = data.products?.tires || products;
        const detectedSize = tireSource[0]?.size || data.searchParams?.size;
        
        if (detectedSize) {
          fetchExpandedTires(detectedSize).then(expandedTires => {
            if (expandedTires.length > 0) setRailTires(expandedTires);
          });
          
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
      
      if (hasWheelData) {
        const wheelSource = data.products?.wheels || wheels;
        const detectedWheelSize = wheelSource[0]?.size || data.searchParams?.wheelSize;
        
        if (detectedWheelSize) {
          fetchExpandedWheels(detectedWheelSize, data.vehicle).then(expandedWheels => {
            if (expandedWheels.length > 0) setRailWheels(expandedWheels);
          });
          
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
      
      if (hasTireData && hasWheelData) {
        setRailsMessage("Click any product to add it to your build");
      } else if (hasTireData) {
        setRailsMessage("Click a tire to learn more and add to your build");
      } else if (hasWheelData) {
        setRailsMessage("Click a wheel to explore options");
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

  // Handle rail product click - NOW injects into conversation
  const handleRailClick = (product: RailProduct) => {
    handleProductInjection(product);
  };

  // Save build manually
  const handleSaveBuild = () => {
    const buildId = saveBuild(buildContext, messages);
    setBuildContext(prev => ({ ...prev, buildId }));
    setShowSaveConfirm(true);
    setTimeout(() => setShowSaveConfirm(false), 3000);
    trackGarageEvent("build_saved", { buildId });
  };

  // Determine which rails to show
  const showLeftRail = railTires.length > 0 || railWheels.length > 0;
  const showRightRail = railTires.length > 0 && railWheels.length > 0;
  const leftRailProducts = railTires.length > 0 ? railTires : railWheels;
  const leftRailTitle = railTires.length > 0 ? "Tire Options" : "Wheel Options";
  const rightRailProducts = railTires.length > 0 && railWheels.length > 0 ? railWheels : [];
  const rightRailTitle = "Wheel Options";

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex h-screen overflow-hidden bg-[#030303]">
      {/* Resume Build Prompt */}
      {showResumePrompt && savedBuildData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative w-16 h-16">
                <Image src="/jake/jake-explaining.png" alt="Jake" fill className="object-contain" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Welcome Back!</h3>
                <p className="text-white/60 text-sm">You have an unfinished build</p>
              </div>
            </div>
            
            {savedBuildData.context.vehicle?.fullName && (
              <div className="bg-white/5 rounded-xl p-4 mb-4">
                <p className="text-white/50 text-xs mb-1">Vehicle</p>
                <p className="text-white font-medium">{savedBuildData.context.vehicle.fullName}</p>
              </div>
            )}
            
            {savedBuildData.context.goal && (
              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <p className="text-white/50 text-xs mb-1">Build Goal</p>
                <p className="text-red-400 font-medium">{savedBuildData.context.goal}</p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={handleResumeBuild}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all"
              >
                Continue Build
              </button>
              <button
                onClick={handleStartFresh}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Toast */}
      {showSaveConfirm && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Build saved! You can resume anytime.
          </div>
        </div>
      )}

      {/* Cinematic Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
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
        <div 
          className="absolute right-0 top-0 bottom-0 w-[60%]"
          style={{
            backgroundImage: 'url(/garage/hero-garage-04.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'right center',
            filter: 'blur(6px) brightness(0.65)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-black/30" />
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 40% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)',
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-red-900/15 to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
      </div>

      {/* Main Content Area */}
      <div className={`relative flex flex-1 ${showSidePanel ? 'lg:mr-[340px]' : ''}`}>
        
        {/* Left Product Rail */}
        {showLeftRail && (
          <ProductRail
            products={leftRailProducts}
            side="left"
            title={leftRailTitle}
            onProductClick={handleRailClick}
            paused={isLoading}
            highlightedId={highlightedProduct}
          />
        )}

        {/* Main Chat Column */}
        <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* Mobile Product Carousel */}
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
            {/* Save Build Button */}
            {messages.length > 0 && (
              <button
                onClick={handleSaveBuild}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm"
                title="Save your build progress"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Save Build
              </button>
            )}
            
            {/* Toggle side panel */}
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

        {/* Rails Message Banner */}
        {showLeftRail && railsMessage && (
          <div className="relative z-10 px-4 py-3 bg-gradient-to-r from-red-900/20 via-red-900/10 to-red-900/20 border-b border-red-500/20">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <JakeAvatar size="sm" />
              <p className="text-white/80 text-sm">{railsMessage}</p>
              <button 
                onClick={() => setRailsMessage(null)}
                className="ml-auto text-white/40 hover:text-white/60 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="relative flex-1 overflow-y-auto px-4 md:px-6 py-6">
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="sticky top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full opacity-30"
              style={{ background: 'radial-gradient(ellipse, rgba(220,38,38,0.1) 0%, transparent 70%)' }}
            />
          </div>
          <div className="relative max-w-2xl mx-auto space-y-6">
            
            {/* Welcome State */}
            {messages.length === 0 && !isLoading && (
              <div className="text-center py-12 animate-fade-in">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
                  <Image src="/jake/jake-explaining.png" alt="Jake" fill className="object-contain relative" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Let&apos;s Build Something</h2>
                <p className="text-white/50 mb-8 max-w-md mx-auto">
                  Tell me what you drive, or pick a build style below. I&apos;ll find the perfect setup.
                </p>
                
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
                {/* User Message */}
                {message.role === "user" && (
                  <div className="max-w-[85%] md:max-w-[70%]">
                    <div className="relative">
                      <div className="absolute -inset-1 bg-red-500/20 rounded-2xl blur-xl" />
                      <div className="relative bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl rounded-br-md px-5 py-3.5 shadow-2xl shadow-red-900/30 border border-red-500/20">
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Product Injection Message - NEW */}
                {message.role === "product-injection" && message.injectedProduct && (
                  <div className="max-w-[90%] md:max-w-[80%]">
                    <ProductInjectionCard product={message.injectedProduct} />
                  </div>
                )}
                
                {/* Assistant Message */}
                {message.role === "assistant" && (
                  <div className="max-w-[90%] md:max-w-[80%]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 relative">
                        <div className="absolute -inset-1 bg-red-500/20 rounded-full blur-md" />
                        <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/20 shadow-lg">
                          <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="relative group">
                          <div className="absolute -inset-1 bg-white/[0.02] rounded-2xl blur-lg group-hover:bg-white/[0.04] transition-all duration-500" />
                          <div className="relative bg-white/[0.06] backdrop-blur-2xl rounded-2xl rounded-tl-md px-5 py-4 border border-white/[0.08] shadow-2xl shadow-black/40">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />
                            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
                            <div className="absolute left-0 top-4 bottom-4 w-px bg-gradient-to-b from-red-500/30 via-red-500/10 to-transparent" />
                            <div className="relative text-white/90 whitespace-pre-wrap leading-relaxed">
                              <MessageContent content={message.content} />
                            </div>
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
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 relative">
                    <div className="absolute -inset-1.5 bg-red-500/30 rounded-full blur-md animate-pulse" />
                    <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-red-500/40 shadow-lg shadow-red-500/20">
                      <Image src="/jake/jake-thinking.png" alt="Jake thinking" fill className="object-cover" />
                    </div>
                  </div>
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
        </div>

        {/* Right Product Rail */}
        {showRightRail && (
          <ProductRail
            products={rightRailProducts}
            side="right"
            title={rightRailTitle}
            onProductClick={handleRailClick}
            paused={isLoading}
            highlightedId={highlightedProduct}
          />
        )}
      </div>

      {/* Right Side Panel - Live Build Dashboard */}
      {showSidePanel && (
        <aside className="hidden lg:flex flex-col fixed right-0 top-0 bottom-0 w-[340px] bg-black/80 backdrop-blur-xl border-l border-white/10 z-30">
          
          {/* Jake Card */}
          <div className="p-6 border-b border-white/10">
            <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl p-5 border border-white/10">
              <div className="absolute -inset-1 bg-red-500/10 rounded-2xl blur-xl pointer-events-none" />
              
              <div className="relative flex items-center gap-4">
                <div className="relative w-16 h-16 rounded-xl overflow-hidden ring-2 ring-red-500/30">
                  <Image
                    src={isLoading ? "/jake/jake-thinking.png" : "/jake/jake-explaining.png"}
                    alt="Jake"
                    fill
                    className="object-cover"
                  />
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

          {/* Live Build State */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            <div>
              <h4 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Live Build
              </h4>
              <div className="space-y-3">
                {/* Vehicle */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">Vehicle</span>
                    {buildContext.vehicle?.fullName ? (
                      <span className="text-white font-medium text-sm">{buildContext.vehicle.fullName}</span>
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
                
                {/* Build Profile - Only show when detected */}
                {buildContext.buildProfile && (
                  <div className="bg-gradient-to-br from-amber-900/20 to-transparent rounded-xl p-4 border border-amber-500/20">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400/70 text-sm">Build Style</span>
                      <span className="text-amber-400 font-medium text-sm">
                        {PROFILE_LABELS[buildContext.buildProfile]}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Considering */}
                {buildContext.consideringProduct && (
                  <div className="bg-gradient-to-br from-red-900/20 to-transparent rounded-xl p-4 border border-red-500/20">
                    <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">Considering</p>
                    <div className="flex items-center gap-3">
                      {buildContext.consideringProduct.imageUrl && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                          <Image
                            src={buildContext.consideringProduct.imageUrl}
                            alt=""
                            width={48}
                            height={48}
                            className="object-contain w-full h-full"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {buildContext.consideringProduct.brand} {buildContext.consideringProduct.model}
                        </p>
                        <p className="text-white/50 text-xs">
                          {buildContext.consideringProduct.size} • {buildContext.consideringProduct.price}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Status */}
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 text-sm">Status</span>
                    <span className={`text-sm font-medium ${
                      buildContext.status === "package_ready" ? "text-green-400" :
                      buildContext.status === "wheels_selected" ? "text-blue-400" :
                      buildContext.status === "tires_selected" ? "text-amber-400" :
                      buildContext.status === "browsing" ? "text-purple-400" :
                      "text-white/50"
                    }`}>
                      {buildContext.status === "package_ready" ? "✓ Package Ready" :
                       buildContext.status === "wheels_selected" ? "Wheels Selected" :
                       buildContext.status === "tires_selected" ? "Tires Selected" :
                       buildContext.status === "browsing" ? "Browsing Options" :
                       "Exploring"}
                    </span>
                  </div>
                </div>
                
                {/* Tire/Wheel Sizes if detected */}
                {(buildContext.tireSize || buildContext.wheelSize) && (
                  <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 space-y-2">
                    {buildContext.tireSize && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-sm">Tire Size</span>
                        <span className="text-white font-mono text-sm">{buildContext.tireSize}</span>
                      </div>
                    )}
                    {buildContext.wheelSize && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-sm">Wheel Size</span>
                        <span className="text-white font-mono text-sm">{buildContext.wheelSize}</span>
                      </div>
                    )}
                  </div>
                )}
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
                  { icon: "🚚", text: "Free Shipping $1500+" },
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

      {/* CSS Animations */}
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

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT INJECTION CARD - Shows when user clicks a rail product
// ═══════════════════════════════════════════════════════════════════════════════

function ProductInjectionCard({ product }: { product: SelectedProduct }) {
  return (
    <div className="animate-fade-in-up">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-red-500/30 to-amber-500/20 rounded-2xl blur-lg" />
        
        <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl p-4 border border-white/10">
          {/* Header badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full uppercase tracking-wider">
              Added to Build
            </span>
            <span className="text-white/30 text-xs">
              {product.type === "wheel" ? "🔘" : "⚫"} {product.type}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Product Image */}
            {product.imageUrl && (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
                <Image
                  src={product.imageUrl}
                  alt={`${product.brand} ${product.model}`}
                  fill
                  className="object-contain p-2"
                />
              </div>
            )}
            
            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-lg truncate">
                {product.brand} {product.model}
              </h4>
              <p className="text-white/60 text-sm">
                {product.size}
                {product.finish && ` • ${product.finish}`}
              </p>
              <p className="text-red-400 font-bold text-lg mt-1">
                {product.price}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE CONTENT RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g);
  
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        
        const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          return (
            <a
              key={idx}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 underline underline-offset-2"
            >
              {linkMatch[1]}
            </a>
          );
        }
        
        const boldMatch = part.match(/\*\*([^*]+)\*\*/);
        if (boldMatch) {
          return <strong key={idx} className="font-semibold text-white">{boldMatch[1]}</strong>;
        }
        
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}
