'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type TrimApiResult = {
  value: string
  label: string
  modificationId: string
  rawTrim?: string
}

type TrimApiResponse = {
  results: TrimApiResult[]
  count?: number
  source?: string
}

function buildResultsUrl(year: string, make: string, model: string, modificationId: string, trimLabel?: string) {
  const params = new URLSearchParams({
    year,
    make,
    model,
    modification: modificationId,
  })
  if (trimLabel) params.set('trim', trimLabel)
  return `/tires?${params.toString()}`
}

function buildFallbackUrl(year: string, make: string, model: string) {
  const params = new URLSearchParams({ year, make, model })
  return `/tires?${params.toString()}`
}

export function VehicleTrimSelector({
  year,
  make,
  model,
  vehicleName,
}: {
  year: string
  make: string
  model: string
  vehicleName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trims, setTrims] = useState<TrimApiResult[]>([])
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        setError(null)

        const qs = new URLSearchParams({ year, make, model })
        const res = await fetch(`/api/vehicles/trims?${qs.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`trims api ${res.status}`)
        const data = (await res.json()) as TrimApiResponse

        if (cancelled) return
        setTrims(Array.isArray(data.results) ? data.results : [])
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || 'Failed to load trims')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [year, make, model])

  const fallbackUrl = useMemo(() => buildFallbackUrl(year, make, model), [year, make, model])

  // Auto-redirect when no trims available (skip showing "fitment not available")
  useEffect(() => {
    if (!loading && !error && trims.length === 0 && !redirecting) {
      setRedirecting(true)
      router.push(fallbackUrl)
    }
  }, [loading, error, trims.length, fallbackUrl, router, redirecting])

  if (loading || redirecting) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold mb-2">Loading fitment options…</h2>
        <p className="text-gray-600">We're finding trims/options for your {vehicleName}.</p>
      </div>
    )
  }

  // Graceful fallback: if API fails, still provide a path (but user will pick trim on /tires)
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-xl font-bold mb-2">Shop tires for your {vehicleName}</h2>
        <p className="text-gray-600 mb-4">
          We couldn't load trim options right now. You can still continue and select your trim on the next page.
        </p>
        <Link
          href={fallbackUrl}
          className="inline-block bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue to Tire Search
        </Link>
      </div>
    )
  }

  // Note: if !trims.length, the useEffect above will auto-redirect to fallbackUrl

  if (trims.length === 1) {
    const t = trims[0]
    const url = buildResultsUrl(year, make, model, t.modificationId, t.label)

    return (
      <div className="bg-blue-600 rounded-lg shadow-lg p-8 text-center text-white mb-8">
        <h2 className="text-2xl font-bold mb-4">Ready to Find Your Tires?</h2>
        <p className="text-blue-100 mb-6">Browse tires that fit your {vehicleName}</p>
        <Link
          href={url}
          className="inline-block bg-white text-blue-600 font-bold py-4 px-8 rounded-lg text-lg hover:bg-blue-50 transition-colors"
        >
          Shop Tires for this Vehicle
        </Link>
      </div>
    )
  }

  // Multiple trims: show selector
  return (
    <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
      <h2 className="text-2xl font-bold mb-2">Select Your Trim</h2>
      <p className="text-gray-600 mb-6">
        Choose your {vehicleName} trim/option to see tires that fit.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {trims.map((t) => (
          <Link
            key={t.modificationId}
            href={buildResultsUrl(year, make, model, t.modificationId, t.label)}
            className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-blue-600">{t.label}</div>
                <div className="text-sm text-gray-500">{year} {make} {model}</div>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
