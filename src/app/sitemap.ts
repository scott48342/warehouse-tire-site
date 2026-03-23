import { MetadataRoute } from 'next'
import { getAllVehicleSlugs } from '@/lib/seo'

const BASE_URL = 'https://shop.warehousetiredirect.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  
  // Static pages (high priority)
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
      url: `${BASE_URL}/schedule`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  // SEO vehicle landing pages (2000+ vehicles)
  const vehicleSlugs = getAllVehicleSlugs()
  const vehiclePages: MetadataRoute.Sitemap = vehicleSlugs.map(slug => ({
    url: `${BASE_URL}/tires/for/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Tire category pages
  const categoryPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/tires/c/all-season`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${BASE_URL}/tires/c/all-terrain`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${BASE_URL}/tires/c/winter`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
  ]

  return [...staticPages, ...categoryPages, ...vehiclePages]
}
