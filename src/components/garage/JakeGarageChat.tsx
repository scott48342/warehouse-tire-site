"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { JakeProductCard, JakeWheelCard, JakePackageCard } from "@/components/jake/JakeProductCards";
import { trackGarageEvent } from "./GarageAnalytics";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  products?: ParsedProduct[];
  wheels?: ParsedWheel[];
  cartUrl?: string;
  packageSummary?: PackageSummary;
}

interface ParsedProduct {
  type: "tire" | "wheel";
  name: string;
  brand?: string;
  model?: string;
  price?: string;
  priceNum?: number;
  warranty?: string;
  size?: string;
  finish?: string;
  fitmentLabel?: string;
  imageUrl?: string;
  productUrl?: string;
  inStock?: boolean;
  setPrice?: string;
  terrain?: string;
  loadRange?: string;
  recommendationBadge?: string;
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

interface PackageSummary {
  tire?: ParsedProduct;
  wheel?: ParsedProduct;
  totalPrice?: string;
  badges?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE CHAT
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageChatProps {
  initialPrompt: string | null;
  onBack: () => void;
}

export function JakeGarageChat({ initialPrompt, onBack }: JakeGarageChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasProcessedInitial = useRef(false);

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
      handleSend(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
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

    try {
      // Build conversation history
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("https://tire-fitment-ai.onrender.com/api/ai/fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: text, 
          history, 
          isLocal: false,
          source: "jake_garage" // Track separately
        }),
      });

      const data = await response.json();
      const responseText = data.response || "Sorry, I had trouble with that. Can you try again?";

      // Parse products from response
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
        trackGarageEvent("recommendation_shown", { type: "wheels", count: wheels.length });
      }

      // Parse cart URL
      const cartUrl = data.cartUrl || parseCartUrl(responseText);
      if (cartUrl) {
        trackGarageEvent("cart_created", { cartUrl: cartUrl.slice(0, 100) });
      }

      // Track vehicle identification
      if (data.vehicle) {
        trackGarageEvent("vehicle_identified", { vehicle: data.vehicle });
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

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                <span className="text-xl">🔧</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a0a0a]" />
            </div>
            <div>
              <h1 className="text-white font-bold">Jake</h1>
              <p className="text-white/50 text-xs">
                {isLoading ? "Typing..." : "Your Fitment Expert"}
              </p>
            </div>
          </div>
        </div>
        <a
          href="https://shop.warehousetiredirect.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          Powered by WTD
        </a>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] ${
                  message.role === "user"
                    ? "bg-red-600 text-white rounded-2xl rounded-br-md px-4 py-3"
                    : "text-white"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                      <span className="text-sm">🔧</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-[#1a1a1a] rounded-2xl rounded-tl-md px-4 py-3 border border-white/10">
                        <p className="text-white/90 whitespace-pre-wrap">{message.content}</p>
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
                        <div className="mt-4 grid grid-cols-2 gap-3">
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
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-green-500/25"
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
                )}
                
                {message.role === "user" && (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center animate-pulse">
                  <span className="text-sm">🔧</span>
                </div>
                <div className="bg-[#1a1a1a] rounded-2xl rounded-tl-md px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-white/50 text-sm">Jake is typing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/10 bg-black/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 focus-within:border-red-500/50 transition-colors">
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
              className="p-2 text-red-500 hover:text-red-400 disabled:text-white/20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
