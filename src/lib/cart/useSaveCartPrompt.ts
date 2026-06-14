"use client";

/**
 * useSaveCartPrompt Hook
 * 
 * Manages the Save My Cart modal trigger logic:
 * - Tracks if user has already saved/skipped
 * - Determines when to show prompt
 * - Provides trigger functions for cart/checkout actions
 * 
 * @created 2026-07-18
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_PREFIX = "wtd_cart_prompt_";

export interface SaveCartPromptConfig {
  cartId?: string;
  hasEmail?: boolean; // Already has email from checkout
  minCartValue?: number;
  currentCartValue?: number;
  itemCount?: number;
}

export interface SaveCartPromptState {
  shouldPrompt: boolean;
  isModalOpen: boolean;
  hasSaved: boolean;
  hasSkipped: boolean;
  
  // Actions
  openModal: () => void;
  closeModal: () => void;
  markSaved: () => void;
  markSkipped: () => void;
  checkShouldPrompt: () => boolean;
  
  // Trigger handlers
  onViewCart: () => void;
  onCheckout: () => void;
}

/**
 * Check if we should show the prompt based on cart state
 */
function checkPromptConditions(config: SaveCartPromptConfig): boolean {
  const { cartId, hasEmail, minCartValue = 50, currentCartValue = 0, itemCount = 0 } = config;
  
  // Don't prompt if no cart
  if (!cartId) return false;
  
  // Don't prompt if already have email
  if (hasEmail) return false;
  
  // Don't prompt for empty carts
  if (itemCount === 0) return false;
  
  // Don't prompt for very low value carts
  if (currentCartValue < minCartValue) return false;
  
  // Check localStorage for saved/skipped state
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}saved_${cartId}`);
    const skipped = localStorage.getItem(`${STORAGE_KEY_PREFIX}skipped_${cartId}`);
    const skippedAt = localStorage.getItem(`${STORAGE_KEY_PREFIX}skipped_at_${cartId}`);
    
    // Don't prompt if already saved
    if (saved === "true") return false;
    
    // Allow re-prompt after 24 hours if skipped
    if (skipped === "true" && skippedAt) {
      const hoursSinceSkip = (Date.now() - parseInt(skippedAt)) / (1000 * 60 * 60);
      if (hoursSinceSkip < 24) return false;
    }
  }
  
  return true;
}

/**
 * Hook to manage Save My Cart prompt state
 */
export function useSaveCartPrompt(config: SaveCartPromptConfig): SaveCartPromptState {
  const { cartId } = config;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  
  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined" && cartId) {
      setHasSaved(localStorage.getItem(`${STORAGE_KEY_PREFIX}saved_${cartId}`) === "true");
      setHasSkipped(localStorage.getItem(`${STORAGE_KEY_PREFIX}skipped_${cartId}`) === "true");
    }
  }, [cartId]);
  
  const checkShouldPrompt = useCallback(() => {
    return checkPromptConditions(config);
  }, [config]);
  
  const shouldPrompt = checkShouldPrompt();
  
  const openModal = useCallback(() => {
    if (shouldPrompt) {
      setIsModalOpen(true);
    }
  }, [shouldPrompt]);
  
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);
  
  const markSaved = useCallback(() => {
    if (typeof window !== "undefined" && cartId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}saved_${cartId}`, "true");
      setHasSaved(true);
    }
    setIsModalOpen(false);
  }, [cartId]);
  
  const markSkipped = useCallback(() => {
    if (typeof window !== "undefined" && cartId) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}skipped_${cartId}`, "true");
      localStorage.setItem(`${STORAGE_KEY_PREFIX}skipped_at_${cartId}`, Date.now().toString());
      setHasSkipped(true);
    }
    setIsModalOpen(false);
  }, [cartId]);
  
  // Handler for View Cart action
  const onViewCart = useCallback(() => {
    if (shouldPrompt) {
      // Small delay to let user see the cart first
      setTimeout(() => {
        setIsModalOpen(true);
      }, 1000);
    }
  }, [shouldPrompt]);
  
  // Handler for Checkout action
  const onCheckout = useCallback(() => {
    if (shouldPrompt) {
      // Show immediately on checkout attempt
      setIsModalOpen(true);
    }
  }, [shouldPrompt]);
  
  return {
    shouldPrompt,
    isModalOpen,
    hasSaved,
    hasSkipped,
    openModal,
    closeModal,
    markSaved,
    markSkipped,
    checkShouldPrompt,
    onViewCart,
    onCheckout,
  };
}

export default useSaveCartPrompt;
