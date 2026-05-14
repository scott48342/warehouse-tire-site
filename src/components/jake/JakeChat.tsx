"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { JakeProductCard, JakePackageCard } from "./JakeProductCards";
import { trackJakeEvent } from "./JakeAnalytics";

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
}

interface PackageSummary {
  tire?: ParsedProduct;
  wheel?: ParsedProduct;
  totalPrice?: string;
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

interface JakeChatProps {
  embedded?: boolean;
  initialPrompt?: string;
  onClose?: () => void;
}

export function JakeChat({ embedded = false, initialPrompt, onClose }: JakeChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    if (hasStarted) {
      inputRef.current?.focus();
    }
  }, [hasStarted]);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt && !hasStarted) {
      handleSend(initialPrompt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    if (!hasStarted) {
      setHasStarted(true);
      trackJakeEvent("conversation_started");
    }

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
      // Build conversation history for context
      const history = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("https://tire-fitment-ai.onrender.com/api/ai/fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history }),
      });

      const data = await response.json();
      const responseText = data.response || "Sorry, I had trouble processing that. Can you try again?";

      // Parse products and cart URL from response
      const products = parseProductsFromResponse(responseText);
      const cartUrl = parseCartUrl(responseText);

      // Track events
      if (products.length > 0) {
        trackJakeEvent("product_recommended", { count: products.length });
      }
      if (cartUrl) {
        trackJakeEvent("cart_created");
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

    } catch (error) {
      console.error("Jake error:", error);
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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
      <div className={`flex flex-col ${embedded ? "h-full" : "min-h-screen"} bg-[#0a0a0a]`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
              <span className="text-white font-bold text-lg">J</span>
            </div>
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
            <span className="text-white font-black text-3xl">J</span>
          </div>
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

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-[#0d0d0d]">
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
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
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
    <div className={`flex flex-col ${embedded ? "h-full" : "min-h-screen"} bg-[#0a0a0a]`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d0d0d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Jake</h1>
            <p className="text-white/50 text-xs">
              {isLoading ? "Thinking..." : "Your Fitment Expert"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMessages([]); setHasStarted(false); }}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
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
                    {message.products.slice(0, 4).map((product, idx) => (
                      <JakeProductCard
                        key={idx}
                        product={product}
                        onClick={() => {
                          trackJakeEvent("product_clicked", { 
                            name: product.name,
                            type: product.type 
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
                  <span className="text-white/50 text-sm">Jake is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-white/10 bg-[#0d0d0d]">
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
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
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
