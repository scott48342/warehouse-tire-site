'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

interface GoogleAdsConversionProps {
  orderId: string
  orderTotal: number // in dollars
  currency?: string
}

export function GoogleAdsConversion({ orderId, orderTotal, currency = 'USD' }: GoogleAdsConversionProps) {
  useEffect(() => {
    // Only fire once per order
    const firedKey = `gads_conversion_${orderId}`
    if (typeof window !== 'undefined' && !sessionStorage.getItem(firedKey)) {
      if (window.gtag) {
        window.gtag('event', 'conversion', {
          send_to: 'AW-410517185/A6xDCNzq474DEMH938MB',
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
  }, [orderId, orderTotal, currency])

  return null
}
