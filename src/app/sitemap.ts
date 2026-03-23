import { MetadataRoute } from 'next'

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

  // TODO: Add dynamic wheel/tire product pages once we have a catalog endpoint
  // Example:
  // const wheels = await fetchWheelSKUs()
  // const wheelPages = wheels.map(sku => ({
  //   url: `${BASE_URL}/wheels/${sku}`,
  //   lastModified: now,
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.7,
  // }))

  return [...staticPages]
}
