import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://shop.warehousetiredirect.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/checkout/',
          '/quote/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
