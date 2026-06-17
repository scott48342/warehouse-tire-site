"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { JakeProductCard, JakePackageCard, ParsedProduct } from "./JakeProductCards";
import { JakeComparePanel, CompareFloatingBar } from "./JakeComparePanel";
import { trackJakeEvent, trackJakeMessage, getJakeSessionId, setJakeSessionId, resetJakeSessionId } from "./JakeAnalytics";
import { JakeAvatar } from "./JakeAvatar";
import { ProductRail, ProductCarousel, MOCK_TIRES, MOCK_WHEELS, RailProduct } from "./ProductRail";
import { VehicleChip } from "./VehicleChip";
import { JakeMockupCard } from "./JakeMockupCard";
import { useVehicleMemory, formatVehicleDisplay, type SavedVehicle } from "@/contexts/VehicleMemoryContext";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface MockupData {
  imageUrl: string;
  disclaimer: string;
  vehicle: string;
  wheelStyle: string;
  // Phase 4: Analytics data
  generationTime?: number;
  cached?: boolean;
  generationMethod?: "gpt-image" | "cached";
  // Phase 2 Enhancement: Confidence level
  confidence?: "high" | "medium" | "concept";
  tireBrand?: string;
  tireModel?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  products?: ParsedProduct[];
  cartUrl?: string;
  packageSummary?: PackageSummary;
  mockup?: MockupData;
}

// ParsedProduct imported from JakeProductCards

interface PackageSummary {
  tire?: ParsedProduct;
  wheel?: ParsedProduct;
  totalPrice?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSATION PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

const JAKE_STORAGE_KEY = "jake_conversation";
const CONVERSATION_EXPIRY_HOURS = 48;

interface PersistedConversation {
  sessionId: string;
  messages: Message[];
  savedAt: number; // timestamp
}

// Sanitize messages before saving (remove sensitive data)
function sanitizeForStorage(messages: Message[]): Message[] {
  return messages.map(msg => ({
    ...msg,
    // Remove cart URLs that might contain payment-related data
    cartUrl: msg.cartUrl?.includes("checkout") ? undefined : msg.cartUrl,
    // Keep product info but strip anything sensitive
    products: msg.products?.map(p => ({
      ...p,
      // Keep only display info, no payment details
    })),
  }));
}

function saveConversation(sessionId: string, messages: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    const data: PersistedConversation = {
      sessionId,
      messages: sanitizeForStorage(messages),
      savedAt: Date.now(),
    };
    localStorage.setItem(JAKE_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("[Jake] Failed to save conversation:", e);
  }
}

function loadConversation(): PersistedConversation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(JAKE_STORAGE_KEY);
    if (!raw) return null;
    
    const data: PersistedConversation = JSON.parse(raw);
    
    // Restore Date objects for timestamps
    data.messages = data.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
    
    return data;
  } catch (e) {
    console.error("[Jake] Failed to load conversation:", e);
    return null;
  }
}

function clearConversation(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(JAKE_STORAGE_KEY);
  } catch (e) {
    console.error("[Jake] Failed to clear conversation:", e);
  }
}

function isConversationStale(savedAt: number): boolean {
  const ageMs = Date.now() - savedAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > CONVERSATION_EXPIRY_HOURS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTED PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

const SUGGESTED_PROMPTS = [
  { text: "Best all-terrain tires for my F-150", icon: "🚚" },
  { text: "Build me an aggressive Ram setup", icon: "🔥" },
  { text: "Quiet highway tires for my SUV", icon: "🛣️" },
  { text: "Will 35s fit my Silverado?", icon: "📏" },
  { text: "Show me black 20\" wheels for my Tahoe", icon: "⚫" },
  { text: "Best tires for towing", icon: "🚛" },
];

// Quick prompts for header (shorter versions)
const HEADER_PROMPTS = [
  "Best tires for my truck",
  "Build me a wheel package",
  "Will bigger tires fit?",
  "Quiet highway tires",
  "Show me black wheels",
  "Budget tire options",
  "Tires for towing",
  "Off-road tire setup",
];

// Get 3 random prompts for header
function getRandomHeaderPrompts(count: number = 3): string[] {
  const shuffled = [...HEADER_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get vehicle-aware suggested prompts
function getVehicleAwarePrompts(vehicle: SavedVehicle): typeof SUGGESTED_PROMPTS {
  const makeModel = `${vehicle.make} ${vehicle.model}`;
  const isTruck = /f-?150|silverado|sierra|ram|tundra|titan|tacoma|colorado|canyon|ranger|gladiator/i.test(vehicle.model);
  const isMuscle = /mustang|camaro|challenger|charger|corvette|firebird|trans am/i.test(vehicle.model);
  const isSUV = /tahoe|suburban|escalade|yukon|4runner|explorer|expedition|durango|grand cherokee/i.test(vehicle.model);
  
  if (isTruck) {
    return [
      { text: `Best all-terrain tires for my ${vehicle.model}`, icon: "🚚" },
      { text: `20" wheel options for my ${makeModel}`, icon: "⚫" },
      { text: `Will 35s fit my ${vehicle.model}?`, icon: "📏" },
      { text: `Build me a package for towing`, icon: "🚛" },
      { text: `Show me aggressive off-road setups`, icon: "🔥" },
      { text: `Quiet highway tires for daily driving`, icon: "🛣️" },
    ];
  }
  
  if (isMuscle) {
    return [
      { text: `Best performance tires for my ${vehicle.model}`, icon: "🏁" },
      { text: `Show me staggered wheel setups`, icon: "🔥" },
      { text: `20" wheel options for my ${makeModel}`, icon: "⚫" },
      { text: `Build me an aggressive setup`, icon: "💪" },
      { text: `Track day tires for my ${vehicle.model}`, icon: "🎯" },
      { text: `Deep dish wheels for that muscle look`, icon: "✨" },
    ];
  }
  
  if (isSUV) {
    return [
      { text: `Best all-season tires for my ${vehicle.model}`, icon: "🚙" },
      { text: `22" wheel options for my ${makeModel}`, icon: "⚫" },
      { text: `Quiet highway tires for family trips`, icon: "🛣️" },
      { text: `All-terrain tires for light off-road`, icon: "🏔️" },
      { text: `Show me a blacked-out package`, icon: "🖤" },
      { text: `Budget tire options for my ${vehicle.model}`, icon: "💰" },
    ];
  }
  
  // Default prompts with vehicle name
  return [
    { text: `Best tires for my ${makeModel}`, icon: "🔍" },
    { text: `Show me wheel options`, icon: "⚫" },
    { text: `Build me a package`, icon: "📦" },
    { text: `What's the OEM tire size?`, icon: "📏" },
    { text: `Quiet highway tires`, icon: "🛣️" },
    { text: `Budget tire options`, icon: "💰" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function parseProductsFromResponse(text: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  
  // Match markdown links: [BRAND MODEL](url) - $XXX
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)[^\$]*\$(\d+(?:\.\d{2})?)/g;
  let match;
  
  while ((match = linkPattern.exec(text)) !== null) {
    const [, name, url, price] = match;
    const isTire = url.includes("/tires/");
    const isWheel = url.includes("/wheels/");
    
    if (isTire || isWheel) {
      // Extract brand and model from name (e.g., "KUMHO ROAD VENTURE AT52")
      const parts = name.trim().split(" ");
      const brand = parts[0];
      const model = parts.slice(1).join(" ");
      
      products.push({
        type: isTire ? "tire" : "wheel",
        name: name.trim(),
        brand,
        model,
        price: `$${price}`,
        priceNum: parseFloat(price),
        productUrl: url,
        inStock: true,
      });
    }
  }
  
  return products;
}

function parseCartUrl(text: string): string | undefined {
  const cartMatch = text.match(/https:\/\/shop\.warehousetiredirect\.com\/cart\/prefill\?data=[^\s)]+/);
  return cartMatch?.[0];
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE CHAT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// Local site out-the-door pricing
const LOCAL_INSTALL_PER_TIRE = 25; // $25/tire = $100 for set of 4
const LOCAL_TAX_RATE = 0.06; // Michigan 6% sales tax

interface JakeChatProps {
  embedded?: boolean;
  initialPrompt?: string;
  onClose?: () => void;
  isLocal?: boolean; // Local site shows out-the-door pricing with installation
  buildContext?: string; // JSON-encoded gallery build context for "Build Something Similar"
}

export function JakeChat({ embedded = false, initialPrompt, onClose, isLocal = false, buildContext }: JakeChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [headerPrompts] = useState(() => getRandomHeaderPrompts(3));
  const [compareProducts, setCompareProducts] = useState<ParsedProduct[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // v2 UI flag (presentation only): cleaner markdown rendering + tighter bubbles.
  // Default v2 as of 2026-06-17 live cutover. Escape hatch to old UI: ?ui=v1
  // (or NEXT_PUBLIC_JAKE_UI=v1). No logic changes — product cards, mockups, build,
  // cart, analytics all unchanged.
  const [useV2Ui, setUseV2Ui] = useState(true);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("ui");
      if (q === "v1") setUseV2Ui(false);
      else if (q === "v2") setUseV2Ui(true);
      else if (process.env.NEXT_PUBLIC_JAKE_UI === "v1") setUseV2Ui(false);
    } catch {
      /* ignore */
    }
  }, []);
  // v2 shows more options in the side rail so it never looks thin on choices.
  // Use a ref so callbacks always read the current value (avoids stale closure).
  const useV2UiRef = useRef(false);
  useV2UiRef.current = useV2Ui;
  const railMax = () => (useV2UiRef.current ? 20 : 6);
  
  // Vehicle Memory Integration
  const { activeVehicle, isLoaded: vehicleLoaded, clearActiveVehicle, setActiveVehicle } = useVehicleMemory();
  
  // Product rail state - populated based on detected intent
  const [railTires, setRailTires] = useState<RailProduct[]>([]);
  const [railWheels, setRailWheels] = useState<RailProduct[]>([]);
  // v2: which product type the right rail currently focuses on. Flips to whatever
  // type Jake most recently surfaced so the customer doesn't have to scroll past
  // 20 wheels to reach tires. "wheel" while shopping wheels; "tire" once tires appear.
  const [activeRailType, setActiveRailType] = useState<"wheel" | "tire">("wheel");
  // v2: latest mockup pinned in the left gutter so the customer keeps the visual
  // (and the Build/Add-to-Cart CTA) in front of them while the chat scrolls.
  // Stores the mockup plus the cartUrl that was live when it was generated.
  const [pinnedMockup, setPinnedMockup] = useState<{ mockup: MockupData; cartUrl?: string } | null>(null);
  const [railsMessage, setRailsMessage] = useState<string | null>(null);
  
  // Persistence state
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const persistenceInitialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard against double execution in React StrictMode
  const hasProcessedInitialPromptRef = useRef(false);
  
  // Streaming state
  const [streamingText, setStreamingText] = useState("");
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const streamingMessageId = useRef<string | null>(null);

  // Compare functions
  const toggleCompare = useCallback((product: ParsedProduct) => {
    setCompareProducts(prev => {
      const exists = prev.some(p => p.name === product.name);
      if (exists) {
        return prev.filter(p => p.name !== product.name);
      }
      if (prev.length >= 4) return prev; // Max 4 products
      return [...prev, product];
    });
  }, []);

  const isInCompare = useCallback((product: ParsedProduct) => {
    return compareProducts.some(p => p.name === product.name);
  }, [compareProducts]);

  const clearCompare = useCallback(() => {
    setCompareProducts([]);
    setShowCompare(false);
  }, []);

  // Auto-scroll to latest message (not the very bottom)
  const scrollToBottom = useCallback(() => {
    // Small delay to let DOM update
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, []);

  // Only auto-scroll when new messages are added, not on every render
  const prevMessageCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    if (hasStarted) {
      inputRef.current?.focus();
    }
  }, [hasStarted]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Load persisted conversation on mount
  useEffect(() => {
    if (persistenceInitialized.current) return;
    persistenceInitialized.current = true;
    
    const saved = loadConversation();
    
    if (saved && saved.messages.length > 0) {
      const isStale = isConversationStale(saved.savedAt);
      
      // If there's an initial prompt (from ?q=), we need to ask what to do
      if (initialPrompt) {
        setPendingInitialPrompt(initialPrompt);
        setShowResumeDialog(true);
        // Temporarily restore for display
        setMessages(saved.messages);
        setHasStarted(true);
        setIsRestored(true);
        setJakeSessionId(saved.sessionId);
        return;
      }
      
      // If conversation is stale, ask to resume or start fresh
      if (isStale) {
        setShowResumeDialog(true);
        // Temporarily restore for display
        setMessages(saved.messages);
        setHasStarted(true);
        setIsRestored(true);
        setJakeSessionId(saved.sessionId);
        return;
      }
      
      // Fresh conversation - restore it
      setMessages(saved.messages);
      setHasStarted(true);
      setIsRestored(true);
      setJakeSessionId(saved.sessionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Save conversation whenever messages change
  useEffect(() => {
    if (messages.length > 0 && !showResumeDialog) {
      const sessionId = getJakeSessionId();
      saveConversation(sessionId, messages);
    }
  }, [messages, showResumeDialog]);
  
  // Handle "Continue Conversation" from resume dialog
  const handleContinueConversation = useCallback(() => {
    setShowResumeDialog(false);
    // If there was a pending initial prompt, send it now
    if (pendingInitialPrompt) {
      handleSend(pendingInitialPrompt);
      setPendingInitialPrompt(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInitialPrompt]);
  
  // Handle "Start Fresh" from resume dialog
  const handleStartFresh = useCallback(() => {
    setShowResumeDialog(false);
    setMessages([]);
    setHasStarted(false);
    setIsRestored(false);
    setPinnedMockup(null);
    setRailTires([]);
    setRailWheels([]);
    clearConversation();
    resetJakeSessionId();
    hasProcessedInitialPromptRef.current = false;
    
    // If there was a pending initial prompt, send it
    if (pendingInitialPrompt) {
      // Small delay to let state clear
      setTimeout(() => {
        handleSend(pendingInitialPrompt);
        setPendingInitialPrompt(null);
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInitialPrompt]);
  
  // Handle "Start New Conversation" button click
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setHasStarted(false);
    setIsRestored(false);
    setCompareProducts([]);
    setShowCompare(false);
    setPinnedMockup(null);
    setRailTires([]);
    setRailWheels([]);
    clearConversation();
    resetJakeSessionId();
    hasProcessedInitialPromptRef.current = false;
    trackJakeEvent("jake_closed"); // Track as session end
  }, []);

  // Handle initial prompt - use ref guard to prevent double execution in StrictMode
  // Only process if no persisted conversation to restore
  useEffect(() => {
    if (initialPrompt && !hasProcessedInitialPromptRef.current && !isRestored && !showResumeDialog) {
      hasProcessedInitialPromptRef.current = true;
      handleSend(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, isRestored, showResumeDialog]);

  // Helper to process products from stream result
  const processStreamProducts = useCallback((productsData: any): ParsedProduct[] => {
    let products: ParsedProduct[] = [];
    
    if (productsData?.tires && productsData.tires.length > 0) {
      products = productsData.tires.map((t: any) => ({
        type: "tire" as const,
        name: `${t.brand} ${t.model}`,
        brand: t.brand,
        model: t.model,
        price: t.price || t.priceEach,
        priceNum: t.priceNum || parseFloat(String(t.price || t.priceEach || "0").replace(/[$,]/g, "")),
        warranty: t.warrantyMiles 
          ? `${Number(t.warrantyMiles).toLocaleString()} miles` 
          : (t.warranty || undefined),
        size: t.size,
        terrain: t.terrain,
        loadRange: t.loadRange,
        speedRating: t.speedRating,
        imageUrl: t.imageUrl,
        productUrl: t.productUrl,
        inStock: t.inStock !== false,
        setPrice: t.priceSet,
      }));
    } else if (productsData?.wheels && productsData.wheels.length > 0) {
      products = productsData.wheels.map((w: any) => ({
        type: "wheel" as const,
        name: `${w.brand} ${w.model || w.name}`,
        brand: w.brand,
        model: w.model || w.name,
        price: w.price || w.priceEach,
        priceNum: w.priceNum || parseFloat(String(w.price || w.priceEach || "0").replace("$", "")),
        size: w.size,
        finish: w.finish,
        fitmentLabel: w.fitmentConfidence,
        imageUrl: w.imageUrl,
        productUrl: w.productUrl,
        inStock: w.inStock !== false,
        setPrice: w.priceSet,
      }));
    } else if (productsData?.staggeredPairs && productsData.staggeredPairs.length > 0) {
      products = productsData.staggeredPairs.map((p: any) => ({
        type: "tire" as const,
        name: p.name || `${p.brand} ${p.model}`,
        brand: p.brand,
        model: p.model,
        price: p.setOfFourFormatted || `$${p.setOfFourPrice}`,
        priceNum: p.setOfFourPrice,
        size: `F: ${p.frontSize} / R: ${p.rearSize}`,
        terrain: p.terrain,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        inStock: true,
      }));
    }
    
    return products;
  }, []);

  // Helper to populate rails from products
  const populateRails = useCallback((productsData: any, products: ParsedProduct[]) => {
    const tireProducts = products.filter(p => p.type === "tire");
    const wheelProducts = products.filter(p => p.type === "wheel");
    
    const hasTireData = tireProducts.length > 0 || 
      (productsData?.tires?.length > 0) || 
      (productsData?.staggeredPairs?.length > 0);
    const hasWheelData = wheelProducts.length > 0 || 
      (productsData?.wheels?.length > 0);
    
    // v2: focus the right rail on whatever was just surfaced. Tires take priority
    // when present in this batch (the customer just moved on to tires); otherwise
    // wheels. This makes the rail SWAP instead of stacking wheels + tires.
    if (hasTireData) setActiveRailType("tire");
    else if (hasWheelData) setActiveRailType("wheel");

    if (hasTireData) {
      const railTireData: RailProduct[] = (productsData?.tires || productsData?.staggeredPairs || tireProducts).slice(0, railMax()).map((t: any) => ({
        id: t.sku || t.productUrl || `tire-${Math.random()}`,
        type: "tire" as const,
        brand: t.brand || "",
        model: t.model || t.name || "",
        size: t.size || "",
        price: typeof t.price === "string" ? t.price : (t.priceEach ? `$${t.priceEach}` : ""),
        priceSet: typeof t.setPrice === "string" ? t.setPrice : (t.priceSet ? `$${t.priceSet}` : ""),
        imageUrl: t.imageUrl,
        badge: t.terrain || t.badge || (t.warrantyMiles > 60000 ? "Long Life" : undefined),
        fitmentBadge: t.loadRange ? `Load Range ${t.loadRange}` : undefined,
      }));
      setRailTires(railTireData);
    }
    
    if (hasWheelData) {
      const railWheelData: RailProduct[] = (productsData?.wheels || wheelProducts).slice(0, railMax()).map((w: any) => ({
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
    }
    
    if (hasTireData && hasWheelData) {
      setRailsMessage("I've got some options for you! Click any product to learn more — I can add anything you like to your build.");
    } else if (hasTireData) {
      setRailsMessage("Here are some tire options. Click any to get details — I can put together your checkout when you're ready.");
    } else if (hasWheelData) {
      setRailsMessage("Check out these wheels! Click any you like and I'll give you the details. Ready to build your setup.");
    }
  }, []);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    if (!hasStarted) {
      setHasStarted(true);
      trackJakeEvent("conversation_started", { prompt: text });
    }

    setInput("");
    inputRef.current?.focus();
    
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    trackJakeMessage("user", text);
    setIsLoading(true);
    setStreamingText("");
    setStreamingStatus("Connecting...");
    streamingMessageId.current = generateId();

    try {
      // Build conversation history for context
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Include saved vehicle context if available
      const vehicleContext = activeVehicle ? {
        year: activeVehicle.year,
        make: activeVehicle.make,
        model: activeVehicle.model,
        trim: activeVehicle.trim,
        modification: activeVehicle.modification,
      } : undefined;
      
      // Track vehicle-aware interaction
      if (activeVehicle) {
        trackJakeEvent("vehicle_context_used", {
          vehicle: formatVehicleDisplay(activeVehicle),
          query_preview: text.substring(0, 50),
        });
      }

      // Parse gallery build context if provided (from "Build Something Similar")
      let parsedBuildContext = undefined;
      if (buildContext) {
        try {
          parsedBuildContext = JSON.parse(decodeURIComponent(buildContext));
          trackJakeEvent("gallery_build_context_used", {
            build: parsedBuildContext?.galleryBuild?.vehicle,
          });
        } catch (e) {
          console.error("[Jake] Failed to parse buildContext:", e);
        }
      }

      // Use streaming API. v2 UI drives the v2 engine (clean look + fast engine);
      // the v1 escape hatch (?ui=v1) explicitly drives the v1 engine so look and
      // engine always stay consistent regardless of the server-side default.
      const streamUrl = useV2Ui ? "/api/jake/chat/stream?engine=v2" : "/api/jake/chat/stream?engine=v1";
      const response = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text, 
          history, 
          isLocal, 
          vehicle: vehicleContext,
          galleryBuildContext: parsedBuildContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let productsData: any = undefined;
      let detectedVehicle: any = undefined;
      let cartUrl: string | undefined;
      let mockupData: MockupData | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEventType = "";
        let currentEventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentEventData = line.slice(6);

            if (currentEventType && currentEventData) {
              try {
                const event = JSON.parse(currentEventData);

                switch (event.type) {
                  case "status":
                    setStreamingStatus(event.status);
                    break;

                  case "text":
                    fullText += event.text;
                    setStreamingText(fullText);
                    setStreamingStatus(null); // Clear status when text flows
                    break;

                  case "products":
                    productsData = event.products;
                    break;

                  case "vehicle":
                    detectedVehicle = event.vehicle;
                    break;

                  case "cartUrl":
                    cartUrl = event.cartUrl;
                    break;

                  case "mockup":
                    mockupData = event.mockup;
                    // Phase 4: Enhanced mockup analytics
                    trackJakeEvent("mockup_succeeded", {
                      vehicle: event.mockup?.vehicle,
                      wheelStyle: event.mockup?.wheelStyle,
                      mockupGenerationTime: event.mockup?.generationTime,
                      mockupCacheHit: event.mockup?.cached,
                      mockupMethod: event.mockup?.generationMethod,
                    });
                    break;

                  case "done":
                    // Stream complete
                    break;

                  case "error":
                    throw new Error(event.error);
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete data
              }
            }

            currentEventType = "";
            currentEventData = "";
          } else if (line === "") {
            currentEventType = "";
            currentEventData = "";
          }
        }
      }

      // Process final response
      const responseText = fullText || "Sorry, I had trouble processing that. Can you try again?";
      
      // Process products
      let products = productsData ? processStreamProducts(productsData) : [];
      if (products.length === 0) {
        products = parseProductsFromResponse(responseText);
      }
      
      // Get cart URL from text if not from stream
      if (!cartUrl) {
        cartUrl = parseCartUrl(responseText);
      }

      // Handle detected vehicle
      if (detectedVehicle?.year && detectedVehicle?.make && detectedVehicle?.model) {
        const shouldSave = !activeVehicle || 
          activeVehicle.year !== String(detectedVehicle.year) ||
          activeVehicle.make !== detectedVehicle.make ||
          activeVehicle.model !== detectedVehicle.model;
        
        if (shouldSave) {
          setActiveVehicle({
            year: String(detectedVehicle.year),
            make: detectedVehicle.make,
            model: detectedVehicle.model,
            trim: detectedVehicle.trim,
          });
          trackJakeEvent("vehicle_learned_from_chat", {
            vehicle: {
              year: String(detectedVehicle.year),
              make: detectedVehicle.make,
              model: detectedVehicle.model,
            },
          });
        }
      }

      // Track events
      if (products.length > 0) {
        trackJakeEvent("product_recommended", { 
          count: products.length,
          products: products.slice(0, 5).map(p => ({
            type: p.type,
            brand: p.brand,
            model: p.model,
            sku: p.productUrl?.match(/\/(tires|wheels)\/([^?/]+)/)?.[2],
          })),
          vehicle: detectedVehicle || activeVehicle ? formatVehicleDisplay(activeVehicle) : undefined,
        });
      }
      
      if (cartUrl) {
        let cartValue: number | undefined;
        try {
          const match = cartUrl.match(/data=([^&]+)/);
          if (match) {
            const decoded = JSON.parse(atob(match[1].replace(/-/g, '+').replace(/_/g, '/')));
            cartValue = decoded.items?.reduce((sum: number, item: any) => 
              sum + (item.price || 0) * (item.quantity || 1), 0);
          }
        } catch {}
        
        trackJakeEvent("cart_created", {
          cartUrl,
          cartValue,
          vehicle: detectedVehicle || undefined,
          products: products.slice(0, 5).map(p => ({
            type: p.type,
            brand: p.brand,
            model: p.model,
          })),
        });
      }

      // Populate rails
      if (productsData) {
        populateRails(productsData, products);
      }

      // Create final message (replacing streaming message)
      const assistantMessage: Message = {
        id: streamingMessageId.current || generateId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        products: products.length > 0 ? products : undefined,
        cartUrl,
        mockup: mockupData,
      };
      setMessages(prev => [...prev, assistantMessage]);
      // Pin the latest mockup to the left gutter (v2). A later cartUrl (even without
      // a new mockup) refreshes the pinned CTA so "Add to Cart" goes straight to checkout.
      if (mockupData) {
        setPinnedMockup({ mockup: mockupData, cartUrl });
      } else if (cartUrl) {
        setPinnedMockup(prev => (prev ? { ...prev, cartUrl } : prev));
      }
      trackJakeMessage("assistant", responseText);

    } catch (error) {
      console.error("Jake error:", error);
      const errorContent = "I'm having trouble connecting right now. Please try again in a moment.";
      const errorMessage: Message = {
        id: streamingMessageId.current || generateId(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      trackJakeMessage("assistant", errorContent);
    } finally {
      setIsLoading(false);
      setStreamingText("");
      setStreamingStatus(null);
      streamingMessageId.current = null;
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    trackJakeEvent("suggested_prompt_clicked", { prompt });
    handleSend(prompt);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER WELCOME STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // Handle rail product click - inject into chat
  const handleRailClick = (product: RailProduct) => {
    const productDesc = `Tell me about the ${product.brand} ${product.model}`;
    handlePromptClick(productDesc);
  };

  // WELCOME STATE - No rails until Jake knows what customer wants
  if (!hasStarted && !initialPrompt) {
    return (
      <div className={`${embedded ? "h-full" : "h-screen"} bg-[#0a0a0a] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Link href="/" className="mr-2 text-white/50 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <JakeAvatar size="md" />
            <div>
              <h1 className="text-white font-bold text-lg">Jake</h1>
              <p className="text-white/50 text-xs">Your Fitment Expert</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Vehicle Chip - Welcome screen */}
            {vehicleLoaded && activeVehicle && (
              <VehicleChip 
                vehicle={activeVehicle}
                onClear={() => {
                  clearActiveVehicle();
                  trackJakeEvent("vehicle_cleared_from_jake");
                }}
                onSendMessage={handleSend}
              />
            )}
            {onClose && (
              <button onClick={onClose} className="text-white/50 hover:text-white p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Welcome Content - Personalized if Jake knows the vehicle */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-6 py-12">
          <JakeAvatar size="xl" showGlow className="mb-6 shadow-lg shadow-red-500/20" />
          
          {vehicleLoaded && activeVehicle ? (
            // Personalized greeting - Jake knows the vehicle
            <>
              <h2 className="text-white font-bold text-2xl mb-2">Hey! Ready for your {activeVehicle.model}?</h2>
              <p className="text-white/60 text-center max-w-md mb-4">
                I've got your <span className="text-red-400 font-medium">{formatVehicleDisplay(activeVehicle)}</span> saved. 
                Just tell me what you're looking for — tires, wheels, or a full package.
              </p>
              <p className="text-white/40 text-center text-sm max-w-sm mb-8">
                💡 I already know your fitment specs, so we can skip right to the good stuff!
              </p>
            </>
          ) : (
            // Default greeting - no vehicle saved
            <>
              <h2 className="text-white font-bold text-2xl mb-2">Hey, I'm Jake</h2>
              <p className="text-white/60 text-center max-w-md mb-4">
                Your wheel and tire expert. Tell me about your vehicle and what you're looking for — 
                I'll help you build the perfect setup.
              </p>
              <p className="text-white/40 text-center text-sm max-w-sm mb-8">
                💡 I can recommend products, build packages, and create your checkout when you're ready.
              </p>
            </>
          )}

          {/* Suggested Prompts - Personalized if vehicle is known */}
          <div className="w-full max-w-xl">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-3 text-center">
              Try asking...
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(vehicleLoaded && activeVehicle
                ? getVehicleAwarePrompts(activeVehicle)
                : SUGGESTED_PROMPTS
              ).map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handlePromptClick(prompt.text)}
                  className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-left transition-all group"
                >
                  <span className="text-lg">{prompt.icon}</span>
                  <span className="text-white/80 text-sm group-hover:text-white">
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input Bar - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#0d0d0d]">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about tires, wheels, or packages..."
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER CONVERSATION STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // Rails now use state-populated products from Jake's responses
  // Left rail = tires (if any), Right rail = wheels (if any)
  // If only one type, show it on left rail
  const showTireRail = railTires.length > 0;
  const showWheelRail = railWheels.length > 0;
  
  // Determine which rails to show and where
  // If both: tires left, wheels right
  // If only tires: tires left
  // If only wheels: wheels left
  // v2 UI: everything lives in ONE right-hand "Your Build" rail (left rail hidden).
  // Old UI: tires left, wheels right (existing behavior).
  const leftRailProducts = showTireRail ? railTires : railWheels;
  // v2: show ONLY the active type so the rail swaps (wheels -> tires) instead of
  // stacking. Falls back to whichever list actually has products.
  const v2ActiveRailProducts =
    activeRailType === "tire"
      ? (showTireRail ? railTires : railWheels)
      : (showWheelRail ? railWheels : railTires);
  const rightRailProducts = useV2Ui
    ? v2ActiveRailProducts
    : ((showTireRail && showWheelRail) ? railWheels : []);
  const showLeftRail = !useV2Ui && (showTireRail || showWheelRail);
  const showRightRail = useV2Ui
    ? (showTireRail || showWheelRail)
    : (showTireRail && showWheelRail);
  const leftRailTitle = showTireRail ? "MATCHING TIRES" : "MATCHING WHEELS";
  const rightRailTitle = useV2Ui
    ? (activeRailType === "tire" ? "MATCHING TIRES" : "MATCHING WHEELS")
    : "MATCHING WHEELS";

  const handleRailProductClick = (product: RailProduct) => {
    const productDesc = `${product.brand} ${product.model}${product.size ? ` (${product.size})` : ""}`;
    setInput(`Tell me about the ${productDesc}`);
    inputRef.current?.focus();
    trackJakeEvent("rail_product_clicked", { product: { type: product.type, brand: product.brand, model: product.model, sku: product.id } });
  };

  return (
    <div className={`flex flex-col ${embedded ? "h-full" : "h-screen"} ${useV2Ui ? "bg-black" : "bg-[#0a0a0a]"} overflow-hidden relative`}>
      {/* Cinematic Background — hidden in v2 UI (pure black) */}
      {!useV2Ui && (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/garage/misc-wheel-wall.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px) brightness(0.6)',
            transform: 'scale(1.05)',
          }}
        />
        <div 
          className="absolute right-0 top-0 bottom-0 w-[50%]"
          style={{
            backgroundImage: 'url(/garage/hero-garage-04.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'right center',
            filter: 'blur(6px) brightness(0.55)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/20 to-black/30" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.5) 100%)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-t from-red-900/10 to-transparent" />
      </div>
      )}

      {/* Main Container - v2: full-width left-aligned; old: centered */}
      <div className={`flex-1 min-h-0 flex relative z-10 ${useV2Ui ? "" : "justify-center"}`}>
        <div className={`flex min-h-0 ${useV2Ui ? "w-full" : "w-full max-w-6xl"}`}>
          {/* Left Product Rail - Desktop (only when we have products) */}
          {showLeftRail && (
            <ProductRail
              products={leftRailProducts}
              side="left"
              title={leftRailTitle}
              onProductClick={handleRailProductClick}
              paused={isLoading}
            />
          )}

          {/* v2: Pinned mockup panel in the left gutter. Uses otherwise-empty space
              so the customer keeps the visual + Build/Add-to-Cart CTA in front of
              them while the chat scrolls. Desktop only; appears once a mockup exists. */}
          {useV2Ui && pinnedMockup && (
            <div className="hidden lg:flex flex-col w-[300px] flex-shrink-0 border-r border-white/5 p-3 overflow-y-auto">
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-2 flex-shrink-0">
                Your Mockup
              </p>
              <JakeMockupCard
                imageUrl={pinnedMockup.mockup.imageUrl}
                disclaimer={pinnedMockup.mockup.disclaimer}
                vehicle={pinnedMockup.mockup.vehicle}
                wheelStyle={pinnedMockup.mockup.wheelStyle}
                generationTime={pinnedMockup.mockup.generationTime}
                cached={pinnedMockup.mockup.cached}
                confidence={pinnedMockup.mockup.confidence}
                tireBrand={pinnedMockup.mockup.tireBrand}
                tireModel={pinnedMockup.mockup.tireModel}
                onBuildSetup={() => {
                  handleSend("Let's build this setup! Help me get these exact products to checkout.");
                }}
                onAddToCart={() => {
                  if (pinnedMockup.cartUrl) {
                    trackJakeEvent("mockup_to_cart", {
                      vehicle: pinnedMockup.mockup.vehicle,
                      wheelStyle: pinnedMockup.mockup.wheelStyle,
                    });
                    window.location.href = pinnedMockup.cartUrl;
                  } else {
                    handleSend("Add this package to my cart!");
                  }
                }}
                onSaveBuild={() => {
                  trackJakeEvent("mockup_saved", {
                    vehicle: pinnedMockup.mockup.vehicle,
                    wheelStyle: pinnedMockup.mockup.wheelStyle,
                  });
                }}
                onMakeChanges={() => {
                  handleSend("I'd like to make some changes to this build.");
                }}
              />
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Mobile Product Carousel (only when we have products) */}
        {showLeftRail && (
          <ProductCarousel
            products={leftRailProducts}
            onProductClick={handleRailProductClick}
          />
        )}

        {/* Resume Conversation Dialog */}
      {showResumeDialog && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <JakeAvatar size="md" />
              <div>
                <h3 className="text-white font-bold text-lg">Welcome back!</h3>
                <p className="text-white/50 text-sm">
                  {pendingInitialPrompt 
                    ? "You have an existing conversation"
                    : "You have a previous conversation"
                  }
                </p>
              </div>
            </div>
            
            {/* Preview of last message */}
            {messages.length > 0 && (
              <div className="bg-white/5 rounded-lg p-3 mb-4 border border-white/10">
                <p className="text-white/40 text-xs mb-1">Last message:</p>
                <p className="text-white/80 text-sm line-clamp-2">
                  {messages[messages.length - 1].content.slice(0, 150)}
                  {messages[messages.length - 1].content.length > 150 ? "..." : ""}
                </p>
              </div>
            )}
            
            <p className="text-white/60 text-sm mb-6">
              {pendingInitialPrompt 
                ? "Would you like to continue your previous conversation or start fresh with your new question?"
                : "Would you like to continue where you left off or start a new conversation?"
              }
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleContinueConversation}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                {pendingInitialPrompt ? "Continue & Ask" : "Continue"}
              </button>
              <button
                onClick={handleStartFresh}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors border border-white/10"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="mr-2 text-white/50 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <JakeAvatar size="md" />
            <div>
              <h1 className="text-white font-bold text-lg">Jake</h1>
              <p className="text-white/50 text-xs">
                {isLoading ? (streamingStatus || "Jake is typing...") : "Your Fitment Expert"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Vehicle Chip - shown when customer has a saved vehicle */}
            {vehicleLoaded && activeVehicle && (
              <VehicleChip 
                vehicle={activeVehicle}
                onClear={() => {
                  clearActiveVehicle();
                  trackJakeEvent("vehicle_cleared_from_jake");
                }}
                onSendMessage={handleSend}
              />
            )}
            <button
              onClick={handleNewConversation}
              className="text-white/50 hover:text-white text-sm px-3 py-1.5 rounded hover:bg-white/5 transition-colors"
            >
              New Chat
            </button>
            {onClose && (
              <button onClick={onClose} className="text-white/50 hover:text-white p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {/* Quick Prompts Row */}
        <div className="px-6 pb-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-white/40 text-xs whitespace-nowrap">Try:</span>
          {headerPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              disabled={isLoading}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/70 hover:text-white text-xs whitespace-nowrap transition-all disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

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

      {/* Messages */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {messages.map((message) => (
            <div key={message.id}>
              {/* Message bubble */}
              <div
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    useV2Ui ? "max-w-[92%]" : "max-w-[85%]"
                  } ${
                    message.role === "user"
                      ? "bg-red-600 text-white"
                      : "bg-white/5 border border-white/10 text-white/90"
                  }`}
                >
                  {/* Message Content */}
                  {useV2Ui ? (
                    <div className="text-sm">
                      <RichMessageContent content={message.content} />
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      <MessageContent content={message.content} />
                    </div>
                  )}
                </div>
              </div>

              {/* Product Cards - Full width horizontal scroll OUTSIDE message bubble */}
              {message.products && message.products.length > 0 && (
                <div 
                  className="mt-3 -mx-4 pb-3"
                  style={{ 
                    overflowX: 'scroll',
                    overflowY: 'hidden',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.3) transparent',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehaviorX: 'contain',
                    touchAction: 'pan-x',
                  }}
                >
                  <div className="flex gap-3 px-4" style={{ width: 'max-content' }}>
                    {message.products.slice(0, 8).map((product, idx) => (
                      <div key={idx} className="flex-shrink-0 w-[280px]">
                        <JakeProductCard
                          product={product}
                          showCompare={true}
                          isComparing={isInCompare(product)}
                          onCompareToggle={() => toggleCompare(product)}
                          compareDisabled={compareProducts.length >= 4}
                          isLocal={isLocal}
                          installCostPerTire={LOCAL_INSTALL_PER_TIRE}
                          taxRate={LOCAL_TAX_RATE}
                          onClick={() => {
                            trackJakeEvent("product_clicked", { 
                              product: {
                                type: product.type,
                                brand: product.brand,
                                model: product.model,
                                name: product.name,
                                sku: product.productUrl?.match(/\/(tires|wheels)\/([^?/]+)/)?.[2],
                                price: product.priceNum,
                              }
                            });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visual Mockup (Phase 3: Conversion CTAs, Phase 2: Confidence) */}
              {message.mockup && (
                <div className="mt-3">
                  <JakeMockupCard
                      imageUrl={message.mockup.imageUrl}
                      disclaimer={message.mockup.disclaimer}
                      vehicle={message.mockup.vehicle}
                      wheelStyle={message.mockup.wheelStyle}
                      generationTime={message.mockup.generationTime}
                      cached={message.mockup.cached}
                      confidence={message.mockup.confidence}
                      tireBrand={message.mockup.tireBrand}
                      tireModel={message.mockup.tireModel}
                      // Phase 3: Conversion CTAs
                      onBuildSetup={() => {
                        // Trigger Jake to help build the setup
                        handleSend("Let's build this setup! Help me get these exact products to checkout.");
                      }}
                      onAddToCart={() => {
                        // If there's a cart URL from the conversation, use it
                        if (message.cartUrl) {
                          trackJakeEvent("mockup_to_cart", {
                            vehicle: message.mockup?.vehicle,
                            wheelStyle: message.mockup?.wheelStyle,
                          });
                          window.location.href = message.cartUrl;
                        } else {
                          // Otherwise ask Jake to build the cart
                          handleSend("Add this package to my cart!");
                        }
                      }}
                      onSaveBuild={() => {
                        // TODO: Implement save to garage functionality
                        trackJakeEvent("mockup_saved", {
                          vehicle: message.mockup?.vehicle,
                          wheelStyle: message.mockup?.wheelStyle,
                        });
                      }}
                    onMakeChanges={() => {
                      handleSend("I'd like to make some changes to this build.");
                    }}
                  />
                </div>
              )}

              {/* Cart CTA - Premium Checkout Link */}
              {message.cartUrl && (
                <div className="mt-3 space-y-2">
                  <a
                    href={message.cartUrl}
                    onClick={() => trackJakeEvent("checkout_started")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-green-500/20"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Your Cart is Ready →
                  </a>
                  <p className="text-white/40 text-xs">
                    ✓ Built by Jake • Click to complete your order
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Streaming Response or Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-2xl">
                <div className="flex items-start gap-3">
                  <img 
                    src="/images/jake/jake-thinking.png" 
                    alt="Jake thinking"
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex flex-col justify-center min-w-[200px]">
                    {streamingText ? (
                      /* Show streaming text as it arrives */
                      <div className="text-white/90 text-sm whitespace-pre-wrap">
                        {streamingText}
                        <span className="inline-block w-2 h-4 bg-red-500/60 ml-1 animate-pulse" />
                      </div>
                    ) : (
                      /* Show status while waiting for text */
                      <>
                        <span className="text-white/70 text-sm font-medium">
                          {streamingStatus || "Finding your perfect setup..."}
                        </span>
                        <div className="flex gap-1 mt-2">
                          <span className="w-2 h-2 bg-red-500/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-red-500/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-red-500/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Compare Floating Bar */}
      <CompareFloatingBar
        count={compareProducts.length}
        onCompare={() => setShowCompare(true)}
        onClear={clearCompare}
      />

      {/* Compare Panel Modal */}
      {showCompare && (
        <JakeComparePanel
          products={compareProducts}
          onRemove={(idx) => setCompareProducts(prev => prev.filter((_, i) => i !== idx))}
          onClear={clearCompare}
          onClose={() => setShowCompare(false)}
          isLocal={isLocal}
          installCostPerTire={LOCAL_INSTALL_PER_TIRE}
          taxRate={LOCAL_TAX_RATE}
        />
      )}

        {/* Input Bar - Fixed at bottom */}
        <div className="relative z-10 flex-shrink-0 p-4 border-t border-white/10 bg-black/60 backdrop-blur-xl">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              {isLoading ? "..." : "Send"}
            </button>
          </div>
          </div>
        </div>

          {/* Right Product Rail - Desktop (only when we have both tires AND wheels) */}
          {showRightRail && (
            <ProductRail
              products={rightRailProducts}
              side="right"
              title={rightRailTitle}
              onProductClick={handleRailProductClick}
              paused={isLoading}
              wide={useV2Ui}
              activeType={activeRailType}
              wheelCount={railWheels.length}
              tireCount={railTires.length}
              onToggleType={setActiveRailType}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE CONTENT RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// RICH MARKDOWN RENDERER (v2 UI) — proper tables / headings / lists / inline.
// Presentation only. Renders safely via React nodes (no dangerouslySetInnerHTML).
// Fixes the old renderer's mangled tables and broken "...HPThttps://" links.
// ─────────────────────────────────────────────────────────────────────────────

// Inline markdown → React nodes: [text](url), **bold**, *italic*, `code`.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Tokenize on links / bold / italic / code, preserving order.
  const regex = /(\[([^\]]+)\]\((https?:[^)\s]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyPrefix}-t${i}`}>{text.slice(last, m.index)}</span>);
    if (m[1]) {
      nodes.push(
        <a
          key={`${keyPrefix}-l${i}`}
          href={m[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:text-red-300 underline underline-offset-2"
        >
          {m[2]}
        </a>
      );
    } else if (m[4]) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-white">{m[5]}</strong>);
    } else if (m[6]) {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="px-1 py-0.5 rounded bg-white/10 text-[0.85em] font-mono">{m[7]}</code>
      );
    } else if (m[8]) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[9]}</em>);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(<span key={`${keyPrefix}-t${i}`}>{text.slice(last)}</span>);
  return nodes;
}

function RichMessageContent({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-");
  const cells = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Table
    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      blocks.push(
        <div key={`tbl-${key++}`} className="my-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {head.map((h, hi) => (
                  <th key={hi} className="text-left font-semibold text-white/90 border-b border-white/20 px-2 py-1">
                    {renderInline(h, `th-${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-white/5">
                  {r.map((c, ci) => (
                    <td key={ci} className="align-top px-2 py-1 text-white/80">
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const sz = h[1].length <= 2 ? "text-base" : "text-sm";
      blocks.push(
        <div key={`h-${key++}`} className={`font-semibold text-white mt-2 mb-1 ${sz}`}>
          {renderInline(h[2], `h-${key}`)}
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line)) { blocks.push(<hr key={`hr-${key++}`} className="my-2 border-white/10" />); i++; continue; }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 my-1 space-y-0.5">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `ul-${key}-${ii}`)}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push(
        <ol key={`ol-${key++}`} className="list-decimal pl-5 my-1 space-y-0.5">
          {items.map((it, ii) => <li key={ii}>{renderInline(it, `ol-${key}-${ii}`)}</li>)}
        </ol>
      );
      continue;
    }

    // Paragraph
    blocks.push(<p key={`p-${key++}`} className="my-1">{renderInline(line, `p-${key}`)}</p>);
    i++;
  }

  return <div className="leading-relaxed">{blocks}</div>;
}

function MessageContent({ content }: { content: string }) {
  // Convert markdown links to clickable links
  // Convert **bold** to bold
  // Convert bullet points
  
  const parts = content.split(/(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g);
  
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        
        // Check if it's a markdown link
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
        
        // Check if it's bold
        const boldMatch = part.match(/\*\*([^*]+)\*\*/);
        if (boldMatch) {
          return <strong key={idx} className="font-semibold text-white">{boldMatch[1]}</strong>;
        }
        
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

export default JakeChat;
