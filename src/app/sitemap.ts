import { MetadataRoute } from 'next'
import { getTopVehicleSlugs } from '@/lib/seo'

const BASE_URL = 'https://shop.warehousetiredirect.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/wheels`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/tires`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/cart`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]

  // SEO vehicle landing pages (top 100 vehicles)
  const vehicleSlugs = getTopVehicleSlugs()
  const vehiclePages: MetadataRoute.Sitemap = vehicleSlugs.map(slug => ({
    url: `${BASE_URL}/tires/for/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...vehiclePages]
}
