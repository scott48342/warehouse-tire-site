"use client";

/**
 * Wheel PDP Conversion Enhancements
 * 
 * Wheel-specific decision support components matching Tire PDP quality.
 * Adapted for wheel-relevant messaging (style, fitment, stance).
 * 
 * @created 2026-04-06
 */

// ============================================================================
// TYPES
// ============================================================================

export type WheelStyle = 
  | 'street'
  | 'sport'
  | 'off-road'
  | 'luxury'
  | 'racing'
  | 'classic'
  | null;

// ============================================================================
// BEST FOR / STYLE GUIDANCE
// ============================================================================

interface BestForWheelProps {
  style?: WheelStyle;
  finish?: string;
  diameter?: string;
}

export function BestForWheel({ style, finish, diameter }: BestForWheelProps) {
  const traits = getBestForTraits(style, finish, diameter);
  const idealFor = getIdealForLine(style, finish);
  
  if (traits.length === 0 && !idealFor) return null;
  
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-700">
        <span className="text-neutral-500 font-medium">Best for:</span>
        {traits.map((trait, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="text-green-600 text-xs">•</span>
            <span>{trait}</span>
          </span>
        ))}
      </div>
      
      {idealFor && (
        <div className="text-[13px] text-neutral-600 italic pl-0.5">
          {idealFor}
        </div>
      )}
    </div>
  );
}

function getBestForTraits(style?: WheelStyle, finish?: string, diameter?: string): string[] {
  const traits: string[] = [];
  
  // Infer style from finish if not provided
  const effectiveStyle = style || inferStyleFromFinish(finish);
  
  switch (effectiveStyle) {
    case 'street':
      traits.push('Daily driving', 'Clean street style', 'Visual upgrade');
      break;
    case 'sport':
      traits.push('Performance builds', 'Track days', 'Aggressive stance');
      break;
    case 'off-road':
      traits.push('Trucks & SUVs', 'Off-road capable', 'Rugged style');
      break;
    case 'luxury':
      traits.push('Premium look', 'Show quality', 'Head-turning style');
      break;
    case 'racing':
      traits.push('Lightweight performance', 'Track use', 'Competition builds');
      break;
    case 'classic':
      traits.push('Retro builds', 'Muscle cars', 'Timeless style');
      break;
    default:
      traits.push('Custom style', 'Daily driving', 'Visual upgrade');
  }
  
  return traits.slice(0, 3);
}

function inferStyleFromFinish(finish?: string): WheelStyle {
  if (!finish) return null;
  const f = finish.toLowerCase();
  
  if (f.includes('matte') || f.includes('satin') || f.includes('gunmetal')) return 'sport';
  if (f.includes('chrome') || f.includes('polished')) return 'luxury';
  if (f.includes('bronze') || f.includes('gold')) return 'sport';
  if (f.includes('black') && (f.includes('gloss') || f.includes('machined'))) return 'street';
  if (f.includes('beadlock') || f.includes('method')) return 'off-road';
  
  return 'street';
}

function getIdealForLine(style?: WheelStyle, finish?: string): string | null {
  const effectiveStyle = style || inferStyleFromFinish(finish);
  
  switch (effectiveStyle) {
    case 'street':
      return "Ideal for: Drivers who want a modern custom look with confident fitment";
    case 'sport':
      return "Ideal for: Enthusiasts who want aggressive styling with performance cred";
    case 'off-road':
      return "Ideal for: Truck and SUV owners who demand durability and bold style";
    case 'luxury':
      return "Ideal for: Those who want a premium, head-turning appearance";
    case 'racing':
      return "Ideal for: Performance-focused builds where weight matters";
    case 'classic':
      return "Ideal for: Classic car builds and retro-inspired projects";
    default:
      return "Ideal for: Drivers upgrading their vehicle's style and stance";
  }
}

// ============================================================================
// WHY CHOOSE THIS WHEEL
// ============================================================================

interface WhyChooseThisWheelProps {
  style?: WheelStyle;
  finish?: string;
  hasVerifiedFit?: boolean;
}

export function WhyChooseThisWheel({ style, finish, hasVerifiedFit }: WhyChooseThisWheelProps) {
  const bullets = getWhyChooseBullets(style, finish, hasVerifiedFit);
  
  if (bullets.length === 0) return null;
  
  return (
    <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-white border border-neutral-100 px-4 py-3 h-full">
      <div className="text-xs font-bold text-neutral-800 mb-2 flex items-center gap-1.5">
        <span>💡</span>
        Why choose this wheel?
      </div>
      <ul className="space-y-1.5">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
            <span className="text-green-600 text-xs mt-0.5">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getWhyChooseBullets(style?: WheelStyle, finish?: string, hasVerifiedFit?: boolean): string[] {
  const bullets: string[] = [];
  const effectiveStyle = style || inferStyleFromFinish(finish);
  
  switch (effectiveStyle) {
    case 'street':
      bullets.push('Modern design that upgrades your vehicle\'s look');
      bullets.push('Strong option for daily-driven street builds');
      break;
    case 'sport':
      bullets.push('Aggressive styling for a performance-oriented stance');
      bullets.push('Popular with enthusiast builds');
      break;
    case 'off-road':
      bullets.push('Built tough for demanding terrain');
      bullets.push('Bold, rugged appearance on any truck or SUV');
      break;
    case 'luxury':
      bullets.push('Premium finish for a high-end appearance');
      bullets.push('Show-quality styling that turns heads');
      break;
    case 'racing':
      bullets.push('Lightweight construction for performance gains');
      bullets.push('Track-ready engineering for serious builds');
      break;
    case 'classic':
      bullets.push('Timeless design that complements classic vehicles');
      bullets.push('Perfect for resto-mod and period-correct builds');
      break;
    default:
      bullets.push('Quality construction from a trusted brand');
      bullets.push('Popular choice for custom wheel upgrades');
  }
  
  // Add fitment confidence if verified
  if (hasVerifiedFit) {
    bullets.push('Verified fitment for confident installation');
  } else {
    bullets.push('Professional fitment verification included');
  }
  
  return bullets.slice(0, 3);
}

// ============================================================================
// COMPARISON CONTEXT
// ============================================================================

interface WheelComparisonContextProps {
  style?: WheelStyle;
  finish?: string;
  diameter?: string;
}

export function WheelComparisonContext({ style, finish, diameter }: WheelComparisonContextProps) {
  const lines = getComparisonLines(style, finish, diameter);
  
  if (lines.length === 0) return null;
  
  return (
    <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-4 py-3 h-full">
      <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-2">
        Compared to similar wheels
      </div>
      <ul className="space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="text-sm text-blue-700 flex items-center gap-1.5">
            <span className="text-blue-500">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getComparisonLines(style?: WheelStyle, finish?: string, diameter?: string): string[] {
  const lines: string[] = [];
  const effectiveStyle = style || inferStyleFromFinish(finish);
  
  switch (effectiveStyle) {
    case 'street':
      lines.push('More aggressive styling than stock wheels');
      lines.push('Balanced fitment for a clean custom stance');
      break;
    case 'sport':
      lines.push('Sportier look than standard aftermarket options');
      lines.push('Better stance than most bolt-on upgrades');
      break;
    case 'off-road':
      lines.push('More rugged than typical truck wheels');
      lines.push('Built tougher than standard all-terrain options');
      break;
    case 'luxury':
      lines.push('Higher-end finish than budget chrome wheels');
      lines.push('Premium quality for a refined appearance');
      break;
    case 'racing':
      lines.push('Lighter than most street-focused wheels');
      lines.push('Track-grade construction for serious performance');
      break;
    case 'classic':
      lines.push('More authentic look than modern repro wheels');
      lines.push('Period-correct styling with modern construction');
      break;
    default:
      lines.push('Custom styling beyond factory options');
      lines.push('Quality construction at a competitive price');
  }
  
  return lines.slice(0, 2);
}

// ============================================================================
// WHAT HAPPENS NEXT
// ============================================================================

export function WheelWhatHappensNext() {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3 h-full">
      <div className="text-xs font-bold text-neutral-800 mb-2 flex items-center gap-1.5">
        <span>📦</span>
        What happens after you order?
      </div>
      <ul className="space-y-1.5">
        <li className="flex items-start gap-2 text-sm text-neutral-700">
          <span className="text-neutral-400 text-xs mt-0.5">1.</span>
          <span>Your wheels ship from trusted suppliers</span>
        </li>
        <li className="flex items-start gap-2 text-sm text-neutral-700">
          <span className="text-neutral-400 text-xs mt-0.5">2.</span>
          <span>Tracking info sent once processed</span>
        </li>
        <li className="flex items-start gap-2 text-sm text-neutral-700">
          <span className="text-neutral-400 text-xs mt-0.5">3.</span>
          <span>Our team can help with fitment questions</span>
        </li>
      </ul>
    </div>
  );
}

// ============================================================================
// ENHANCED TRUST STRIP (for CTA box)
// ============================================================================

interface WheelTrustStripProps {
  hasVehicle: boolean;
}

export function WheelTrustStrip({ hasVehicle }: WheelTrustStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-green-700 py-2 border-t border-green-200/50 mt-3">
      {hasVehicle && (
        <span className="inline-flex items-center gap-1">
          <span>✔</span>
          <span>Verified fit for your vehicle</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span>✔</span>
        <span>Ships fast from trusted suppliers</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <span>✔</span>
        <span>Expert fitment support</span>
      </span>
    </div>
  );
}

// ============================================================================
// WARRANTY & SUPPORT
// ============================================================================

export function WheelWarrantySupport() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <div className="text-sm font-extrabold text-neutral-900 mb-4 flex items-center gap-2">
        <span>🛡️</span>
        Warranty & Support
      </div>
      <ul className="space-y-3">
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
          <span>Manufacturer warranty included</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
          <span>Fitment guaranteed — we verify before shipping</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
          <span>Expert support for accessory questions</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">📞</span>
          <span>Questions? We're here to help</span>
        </li>
      </ul>
    </div>
  );
}

// ============================================================================
// POPULAR CHOICE SIGNAL
// ============================================================================

interface WheelPopularChoiceProps {
  style?: WheelStyle;
  finish?: string;
}

export function WheelPopularChoice({ style, finish }: WheelPopularChoiceProps) {
  const message = getPopularMessage(style, finish);
  
  if (!message) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50/70 rounded-lg px-3 py-2 border border-amber-100">
      <span>🔥</span>
      <span className="font-medium">{message}</span>
    </div>
  );
}

function getPopularMessage(style?: WheelStyle, finish?: string): string | null {
  const effectiveStyle = style || inferStyleFromFinish(finish);
  
  switch (effectiveStyle) {
    case 'street':
      return "Popular choice — customers love this for daily drivers";
    case 'sport':
      return "Enthusiast favorite for performance builds";
    case 'off-road':
      return "Top pick for truck and SUV owners";
    case 'luxury':
      return "Premium choice for a refined look";
    default:
      return "Popular wheel upgrade choice";
  }
}

// ============================================================================
// WHEEL SPECS CARD
// ============================================================================

interface WheelSpecsCardProps {
  diameter?: string;
  width?: string;
  boltPattern?: string;
  offset?: string;
  centerBore?: string;
  finish?: string;
  loadRating?: string;
}

export function WheelSpecsCard({
  diameter,
  width,
  boltPattern,
  offset,
  centerBore,
  finish,
  loadRating,
}: WheelSpecsCardProps) {
  const specs = [
    { label: 'Diameter', value: diameter ? `${diameter}"` : null },
    { label: 'Width', value: width ? `${width}"` : null },
    { label: 'Bolt Pattern', value: boltPattern },
    { label: 'Offset', value: offset ? `${offset}mm` : null },
    { label: 'Center Bore', value: centerBore ? `${centerBore}mm` : null },
    { label: 'Finish', value: finish },
    { label: 'Load Rating', value: loadRating },
  ].filter(s => s.value);
  
  if (specs.length === 0) return null;
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <div className="text-sm font-extrabold text-neutral-900 mb-4">Full Specifications</div>
      <div className="grid gap-0 text-sm">
        {specs.map((spec, i) => (
          <div key={spec.label} className={`flex justify-between items-center py-2.5 ${i < specs.length - 1 ? 'border-b border-neutral-100' : ''}`}>
            <span className="text-neutral-500 font-medium">{spec.label}</span>
            <span className="font-bold text-neutral-900">{spec.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
