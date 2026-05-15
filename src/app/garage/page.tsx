"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { JakeGarageChat } from "@/components/garage/JakeGarageChat";
import { JakeGarageHero } from "@/components/garage/JakeGarageHero";
import { trackGarageEvent } from "@/components/garage/GarageAnalytics";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE - Conversational Wheel & Tire Shopping
// ═══════════════════════════════════════════════════════════════════════════════

const EXAMPLE_PROMPTS = [
  { text: "Build an aggressive Ram setup", icon: "🔥" },
  { text: "Quiet tires for my SUV", icon: "🔇" },
  { text: "Black 20s for my Tahoe", icon: "⚫" },
  { text: "All-terrain tires for towing", icon: "🚛" },
  { text: "Will 35s fit my Silverado?", icon: "📏" },
  { text: "Lifted truck wheel package", icon: "⬆️" },
];

export default function JakeGaragePage() {
  const [hasStarted, setHasStarted] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  useEffect(() => {
    // Track page open
    trackGarageEvent("jake_garage_opened");
  }, []);

  const handleStart = useCallback((prompt: string) => {
    setInitialPrompt(prompt);
    setHasStarted(true);
    trackGarageEvent("conversation_started", { prompt });
  }, []);

  // Show hero if not started, otherwise show chat
  if (!hasStarted) {
    return (
      <JakeGarageHero
        examplePrompts={EXAMPLE_PROMPTS}
        onStart={handleStart}
      />
    );
  }

  return (
    <JakeGarageChat
      initialPrompt={initialPrompt}
      onBack={() => {
        setHasStarted(false);
        setInitialPrompt(null);
      }}
    />
  );
}
