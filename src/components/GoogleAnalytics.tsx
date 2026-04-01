'use client'

import Script from 'next/script'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const GOOGLE_ADS_ID = 'AW-410517185'

export function GoogleAnalytics() {
  // Always render if we have either GA or Google Ads
  if (!GA_MEASUREMENT_ID && !GOOGLE_ADS_ID) {
    return null
  }

  // Use GA ID for script loading, fall back to Ads ID
  const primaryId = GA_MEASUREMENT_ID || GOOGLE_ADS_ID

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}', { page_path: window.location.pathname });` : ''}
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
    </>
  )
}
