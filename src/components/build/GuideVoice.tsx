"use client";

import { useBuild } from "./BuildContext";

// ============================================================================
// Guide Messages - Conversational, Friendly, Short
// ============================================================================

type GuideMessageKey = 
  | "vehicle-start"
  | "wheels-intro"
  | "wheels-selected"
  | "tires-intro"
  | "tires-selected"
  | "review-intro"
  | "review-complete";

const GUIDE_MESSAGES: Record<GuideMessageKey, string> = {
  "vehicle-start": "Let's find your perfect wheel and tire setup.",
  "wheels-intro": "Let's start with wheels — I'll make sure everything fits perfectly.",
  "wheels-selected": "Nice choice — these will fit great. Let me show you the best tires to match.",
  "tires-intro": "These tires are matched specifically to your wheels and vehicle.",
  "tires-selected": "Great pick. Your setup is looking solid.",
  "review-intro": "Everything here is guaranteed to fit your vehicle — no guesswork.",
  "review-complete": "You're all set — this setup will fit perfectly.",
};

// ============================================================================
// GuideVoice Component
// ============================================================================

export function GuideVoice({ 
  messageKey,
  className = "",
}: { 
  messageKey: GuideMessageKey;
  className?: string;
}) {
  const message = GUIDE_MESSAGES[messageKey];
  
  if (!message) return null;

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {/* Guide avatar/icon */}
      <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm shadow-sm">
        👋
      </div>
      
      {/* Message bubble */}
      <div className="flex-1 rounded-2xl rounded-tl-sm bg-gradient-to-r from-slate-50 to-neutral-50 border border-neutral-200 px-4 py-2.5 shadow-sm">
        <p className="text-sm text-neutral-700 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Contextual Guide - Auto-selects message based on build state
// ============================================================================

export function ContextualGuide({ className = "" }: { className?: string }) {
  const { state } = useBuild();
  
  let messageKey: GuideMessageKey;
  
  if (!state.vehicle) {
    messageKey = "vehicle-start";
  } else if (state.step === "wheels" && !state.wheel) {
    messageKey = "wheels-intro";
  } else if (state.step === "wheels" && state.wheel) {
    messageKey = "wheels-selected";
  } else if (state.step === "tires" && !state.tire) {
    messageKey = "tires-intro";
  } else if (state.step === "tires" && state.tire) {
    messageKey = "tires-selected";
  } else if (state.step === "review" && state.wheel && state.tire) {
    messageKey = "review-complete";
  } else {
    messageKey = "review-intro";
  }
  
  return <GuideVoice messageKey={messageKey} className={className} />;
}

// ============================================================================
// Inline Guide - Smaller, for use within sections
// ============================================================================

export function InlineGuide({ 
  message,
  className = "",
}: { 
  message: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 text-sm text-neutral-600 ${className}`}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px]">
        💡
      </span>
      <span className="italic">{message}</span>
    </div>
  );
}
