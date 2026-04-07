'use client'

import { useEffect } from 'react'

interface GoogleAdsConversionProps {
  orderId: string
  orderTotal: number // in dollars
  currency?: string
  /** If true, skip conversion tracking (test/internal orders) */
  isTest?: boolean
  /** Customer email - used for additional test detection */
  customerEmail?: string | null
}

/** Internal email patterns that indicate test data (must match server-side testData.ts) */
const TEST_EMAIL_PATTERNS = [
  /@warehousetiredirect\.com$/i,
  /@wtd\.com$/i,
  /^test[@+]/i,
  /^dev[@+]/i,
  /^admin[@+]/i,
  /\+test@/i,
  /\+dev@/i,
  /@example\.com$/i,
  /@test\.com$/i,
  /@localhost$/i,
]

function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return TEST_EMAIL_PATTERNS.some(pattern => pattern.test(email))
}

export function GoogleAdsConversion({ 
  orderId, 
  orderTotal, 
  currency = 'USD',
  isTest = false,
  customerEmail,
}: GoogleAdsConversionProps) {
  useEffect(() => {
    // Skip if explicitly marked as test
    if (isTest) {
      console.log('[GoogleAdsConversion] Skipped: test order', { orderId })
      return
    }
    
    // Skip if customer email matches test patterns
    if (isTestEmail(customerEmail)) {
      console.log('[GoogleAdsConversion] Skipped: test email', { orderId, customerEmail })
      return
    }
    
    // Skip if order total is zero or negative (likely test/cancelled)
    if (orderTotal <= 0) {
      console.log('[GoogleAdsConversion] Skipped: zero/negative total', { orderId, orderTotal })
      return
    }
    
    // Only fire once per order (dedupe via sessionStorage)
    const firedKey = `gads_conversion_${orderId}`
    if (typeof window !== 'undefined' && !sessionStorage.getItem(firedKey)) {
      const gtag = (window as any).gtag
      if (gtag) {
        gtag('event', 'conversion', {
          send_to: 'AW-410517185/5n2CCKGElZccEMH938MB',
          value: orderTotal,
          currency: currency,
          transaction_id: orderId,
        })
        sessionStorage.setItem(firedKey, 'true')
        console.log('[GoogleAdsConversion] Fired:', { orderId, orderTotal, currency })
      } else {
        console.warn('[GoogleAdsConversion] gtag not found')
      }
    }
  }, [orderId, orderTotal, currency, isTest, customerEmail])

  return null
}
