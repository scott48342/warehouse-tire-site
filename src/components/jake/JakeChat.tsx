"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { JakeProductCard, JakePackageCard, ParsedProduct } from "./JakeProductCards";
import { JakeComparePanel, CompareFloatingBar } from "./JakeComparePanel";
import { trackJakeEvent, trackJakeMessage, getJakeSessionId, setJakeSessionId, resetJakeSessionId } from "./JakeAnalytics";
import { JakeAvatar } from "./JakeAvatar";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  products?: ParsedProduct[];
  cartUrl?: string;
  packageSummary?: PackageSummary;
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
}

export function JakeChat({ embedded = false, initialPrompt, onClose, isLocal = false }: JakeChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [headerPrompts] = useState(() => getRandomHeaderPrompts(3));
  const [compareProducts, setCompareProducts] = useState<ParsedProduct[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  
  // Persistence state
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const persistenceInitialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard against double execution in React StrictMode
  const hasProcessedInitialPromptRef = useRef(false);

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

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    if (!hasStarted) {
      setHasStarted(true);
      trackJakeEvent("conversation_started", { prompt: text });
    }

    setInput("");
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    trackJakeMessage("user", text); // Track for conversation replay
    setIsLoading(true);

    try {
      // Build conversation history for context
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("https://tire-fitment-ai.onrender.com/api/ai/fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history, isLocal }),
      });

      const data = await response.json();
      const responseText = data.response || "Sorry, I had trouble processing that. Can you try again?";

      // Use structured products from backend if available, fallback to parsing markdown
      let products: ParsedProduct[] = [];
      
      // Check for structured tire data
      if (data.products?.tires && data.products.tires.length > 0) {
        products = data.products.tires.map((t: any) => ({
          type: "tire" as const,
          name: `${t.brand} ${t.model}`,
          brand: t.brand,
          model: t.model,
          price: t.price || t.priceEach,
          priceNum: t.priceNum || parseFloat(String(t.price || t.priceEach || "0").replace(/[$,]/g, "")),
          // Format warranty miles as string
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
      }
      // Check for structured wheel data
      else if (data.products?.wheels && data.products.wheels.length > 0) {
        products = data.products.wheels.map((w: any) => ({
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
      }
      // Check for staggered pairs
      else if (data.products?.staggeredPairs && data.products.staggeredPairs.length > 0) {
        products = data.products.staggeredPairs.map((p: any) => ({
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
      // Fallback to parsing markdown if no structured data
      else {
        products = parseProductsFromResponse(responseText);
      }
      
      // Get cart URL from structured data or parse from text
      const cartUrl = data.cartUrl || parseCartUrl(responseText);

      // Track events with rich data
      if (products.length > 0) {
        trackJakeEvent("product_recommended", { 
          count: products.length,
          products: products.slice(0, 5).map(p => ({
            type: p.type,
            brand: p.brand,
            model: p.model,
            sku: p.productUrl?.match(/\/(tires|wheels)\/([^?/]+)/)?.[2],
          })),
          vehicle: data.vehicle || undefined,
        });
      }
      if (cartUrl) {
        // Try to parse cart value from URL
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
          vehicle: data.vehicle || undefined,
          products: products.slice(0, 5).map(p => ({
            type: p.type,
            brand: p.brand,
            model: p.model,
          })),
        });
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
        products: products.length > 0 ? products : undefined,
        cartUrl,
      };
      setMessages(prev => [...prev, assistantMessage]);
      trackJakeMessage("assistant", responseText); // Track for conversation replay

    } catch (error) {
      console.error("Jake error:", error);
      const errorContent = "I'm having trouble connecting right now. Please try again in a moment.";
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      trackJakeMessage("assistant", errorContent); // Track error responses too
    } finally {
      setIsLoading(false);
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

  if (!hasStarted && !initialPrompt) {
    return (
      <div className={`flex flex-col ${embedded ? "h-full" : "h-screen"} bg-[#0a0a0a] overflow-hidden`}>
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
          {onClose && (
            <button onClick={onClose} className="text-white/50 hover:text-white p-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Welcome Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-6 py-12">
          <JakeAvatar size="xl" showGlow className="mb-6 shadow-lg shadow-red-500/20" />
          <h2 className="text-white font-bold text-2xl mb-2">Hey, I'm Jake</h2>
          <p className="text-white/60 text-center max-w-md mb-8">
            Your wheel and tire expert. Tell me about your vehicle and what you're looking for — 
            I'll help you find the perfect setup.
          </p>

          {/* Suggested Prompts */}
          <div className="w-full max-w-xl">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-3 text-center">
              Try asking...
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
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

  return (
    <div className={`flex flex-col ${embedded ? "h-full" : "h-screen"} bg-[#0a0a0a] overflow-hidden relative`}>
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
      <div className="flex-shrink-0 border-b border-white/10 bg-[#0d0d0d]">
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
                {isLoading ? "Typing..." : "Your Fitment Expert"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6 pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-red-600 text-white"
                    : "bg-white/5 border border-white/10 text-white/90"
                }`}
              >
                {/* Message Content */}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  <MessageContent content={message.content} />
                </div>

                {/* Product Cards */}
                {message.products && message.products.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {message.products.slice(0, 6).map((product, idx) => (
                      <JakeProductCard
                        key={idx}
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
                    ))}
                  </div>
                )}

                {/* Cart CTA */}
                {message.cartUrl && (
                  <div className="mt-4">
                    <a
                      href={message.cartUrl}
                      onClick={() => trackJakeEvent("checkout_started")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Proceed to Checkout
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-white/50 text-sm">Jake is typing...</span>
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
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#0d0d0d]">
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
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE CONTENT RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

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
