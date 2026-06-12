'use client'

/**
 * Microsoft Clarity Integration
 * 
 * Provides session recordings, heatmaps, scroll depth, rage clicks, and dead clicks.
 * Free tool for understanding user behavior.
 * 
 * Setup:
 * 1. Go to https://clarity.microsoft.com
 * 2. Create a new project
 * 3. Add your site URL (shop.warehousetiredirect.com)
 * 4. Copy the project ID from the setup wizard
 * 5. Add NEXT_PUBLIC_CLARITY_PROJECT_ID to .env.local and Vercel
 * 
 * Features tracked:
 * - Session recordings (replay user sessions)
 * - Heatmaps (click maps, scroll maps)
 * - Rage clicks (user frustration signals)
 * - Dead clicks (clicks that do nothing)
 * - JavaScript errors
 * - Quick insights and filters
 * 
 * @see https://clarity.microsoft.com
 */

import Script from 'next/script'

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

export function MicrosoftClarity() {
  // Don't render if no project ID configured
  if (!CLARITY_PROJECT_ID) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Clarity] No project ID configured. Set NEXT_PUBLIC_CLARITY_PROJECT_ID to enable.')
    }
    return null
  }

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
      `}
    </Script>
  )
}

/**
 * Clarity API helpers for custom tracking
 * 
 * Usage:
 *   import { clarityIdentify, clarityEvent, clarityUpgrade } from '@/components/MicrosoftClarity'
 *   
 *   // Identify a user (optional, for logged-in users)
 *   clarityIdentify('user123', 'session456', 'page789')
 *   
 *   // Track custom event
 *   clarityEvent('add_to_cart')
 *   
 *   // Upgrade session priority (ensure it gets recorded)
 *   clarityUpgrade('high_value_user')
 */

declare global {
  interface Window {
    clarity?: (method: string, ...args: unknown[]) => void
  }
}

/**
 * Identify a user in Clarity (for logged-in users)
 */
export function clarityIdentify(userId: string, sessionId?: string, pageId?: string) {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('identify', userId, sessionId, pageId)
  }
}

/**
 * Track a custom event in Clarity
 */
export function clarityEvent(eventName: string) {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('event', eventName)
  }
}

/**
 * Mark session as high priority (ensures it gets recorded)
 * Use for: checkout sessions, high-value actions, bug reproductions
 */
export function clarityUpgrade(reason: string) {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('upgrade', reason)
  }
}

/**
 * Set custom tags for filtering sessions
 */
export function claritySetTag(key: string, value: string) {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity('set', key, value)
  }
}

export default MicrosoftClarity
