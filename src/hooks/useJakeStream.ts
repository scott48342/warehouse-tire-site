/**
 * useJakeStream Hook
 * 
 * Handles streaming chat with Jake, providing:
 * - Incremental text updates
 * - Status messages for UI feedback
 * - Products/vehicle data when available
 * - Error handling with fallback to non-streaming
 * 
 * @created 2026-06-14
 */

import { useState, useCallback, useRef } from "react";

interface StreamMessage {
  role: "user" | "assistant";
  content: string;
}

interface VehicleContext {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  modification?: string;
}

interface StreamResult {
  text: string;
  products?: {
    tires?: any[];
    wheels?: any[];
    staggeredPairs?: any[];
  };
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
  };
  cartUrl?: string;
  toolsUsed: string[];
  duration_ms: number;
}

interface UseJakeStreamOptions {
  onTextChunk?: (chunk: string, fullText: string) => void;
  onStatus?: (status: string) => void;
  onProducts?: (products: StreamResult["products"]) => void;
  onVehicle?: (vehicle: StreamResult["vehicle"]) => void;
  onComplete?: (result: StreamResult) => void;
  onError?: (error: string) => void;
}

export function useJakeStream(options: UseJakeStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const sendMessage = useCallback(async (
    query: string,
    history: StreamMessage[],
    isLocal: boolean,
    vehicle?: VehicleContext
  ): Promise<StreamResult | null> => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsStreaming(true);
    setCurrentStatus("Connecting...");
    setStreamedText("");
    
    let fullText = "";
    let products: StreamResult["products"] = undefined;
    let detectedVehicle: StreamResult["vehicle"] = undefined;
    let cartUrl: string | undefined;
    let toolsUsed: string[] = [];
    let duration_ms = 0;
    
    try {
      const response = await fetch("/api/jake/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history, isLocal, vehicle }),
        signal: abortController.signal,
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
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
        
        let currentEventType = "";
        let currentEventData = "";
        
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentEventData = line.slice(6);
            
            // Process the event
            if (currentEventType && currentEventData) {
              try {
                const event = JSON.parse(currentEventData);
                
                switch (event.type) {
                  case "status":
                    setCurrentStatus(event.status);
                    options.onStatus?.(event.status);
                    break;
                    
                  case "text":
                    fullText += event.text;
                    setStreamedText(fullText);
                    options.onTextChunk?.(event.text, fullText);
                    // Clear status when text starts flowing
                    setCurrentStatus(null);
                    break;
                    
                  case "products":
                    products = event.products;
                    options.onProducts?.(event.products);
                    break;
                    
                  case "vehicle":
                    detectedVehicle = event.vehicle;
                    options.onVehicle?.(event.vehicle);
                    break;
                    
                  case "cartUrl":
                    cartUrl = event.cartUrl;
                    break;
                    
                  case "done":
                    toolsUsed = event.meta?.toolsUsed || [];
                    duration_ms = event.meta?.duration_ms || 0;
                    break;
                    
                  case "error":
                    throw new Error(event.error);
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete data
                if (currentEventType !== "text") {
                  console.warn("[useJakeStream] Parse error:", parseError);
                }
              }
            }
            
            // Reset for next event
            currentEventType = "";
            currentEventData = "";
          } else if (line === "") {
            // Event separator
            currentEventType = "";
            currentEventData = "";
          }
        }
      }
      
      const result: StreamResult = {
        text: fullText,
        products,
        vehicle: detectedVehicle,
        cartUrl,
        toolsUsed,
        duration_ms,
      };
      
      options.onComplete?.(result);
      
      return result;
      
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[useJakeStream] Request aborted");
        return null;
      }
      
      console.error("[useJakeStream] Error:", error);
      const errorMessage = "I'm having trouble connecting right now. Please try again in a moment.";
      options.onError?.(errorMessage);
      
      // Try fallback to non-streaming endpoint
      try {
        console.log("[useJakeStream] Falling back to non-streaming...");
        const fallbackResponse = await fetch("/api/jake/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, history, isLocal, vehicle }),
        });
        
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          const result: StreamResult = {
            text: data.response || errorMessage,
            products: data.products,
            vehicle: data.vehicle,
            cartUrl: data.cartUrl,
            toolsUsed: data.meta?.toolsUsed || [],
            duration_ms: data.meta?.duration_ms || 0,
          };
          
          setStreamedText(result.text);
          options.onComplete?.(result);
          return result;
        }
      } catch (fallbackError) {
        console.error("[useJakeStream] Fallback also failed:", fallbackError);
      }
      
      return {
        text: errorMessage,
        toolsUsed: [],
        duration_ms: 0,
      };
      
    } finally {
      setIsStreaming(false);
      setCurrentStatus(null);
      abortControllerRef.current = null;
    }
  }, [options]);
  
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setCurrentStatus(null);
  }, []);
  
  return {
    sendMessage,
    abort,
    isStreaming,
    currentStatus,
    streamedText,
  };
}
