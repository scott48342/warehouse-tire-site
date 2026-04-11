import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { getPostBySlug, getAllPosts } from '@/lib/blog'
import ReactMarkdown from 'react-markdown'

const BASE_URL = 'https://shop.warehousetiredirect.com'

// Regenerate every 24 hours
export const revalidate = 86400

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return posts.map(post => ({ slug: post.slug }))
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  
  if (!post) {
    return { title: 'Post Not Found' }
  }

  const canonicalUrl = `${BASE_URL}/blog/${slug}`

  return {
    title: `${post.title} | Warehouse Tire Direct`,
    description: post.description,
    authors: [{ name: post.author }],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonicalUrl,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      images: post.image ? [post.image] : [],
    },
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogPostPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  
  if (!post) {
    notFound()
  }

  // Structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    datePublished: post.date,
    publisher: {
      '@type': 'Organization',
      name: 'Warehouse Tire Direct',
      url: BASE_URL,
    },
    mainEntityOfPage: `${BASE_URL}/blog/${slug}`,
    image: post.image,
  }

  return (
    <>
      <Script
        id="article-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <main className="min-h-screen bg-gray-50">
        {/* Hero */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-400 mb-4">
              <Link href="/blog" className="hover:text-white">Blog</Link>
              <span className="mx-2">›</span>
              <span className="text-gray-300">{post.category}</span>
            </nav>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-oswald mb-4">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-gray-300">
              <span>By {post.author}</span>
              <span>•</span>
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>•</span>
              <span>{post.readingTime} min read</span>
            </div>
          </div>
        </section>

        {/* Featured Image */}
        {post.image && (
          <div className="container mx-auto px-4 max-w-4xl -mt-8">
            <div className="relative h-64 md:h-96 w-full rounded-lg overflow-hidden shadow-lg">
              <Image
                src={post.image}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        )}

        {/* Content */}
        <article className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
            <div className="prose prose-lg max-w-none prose-headings:font-oswald prose-headings:text-gray-900 prose-a:text-red-600 prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map(tag => (
                <span 
                  key={tag}
                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 bg-red-600 text-white rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Ready to Upgrade Your Ride?</h2>
            <p className="mb-4 text-red-100">
              Shop our selection of wheels, tires, and packages with guaranteed fitment.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                href="/wheels"
                className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100"
              >
                Shop Wheels
              </Link>
              <Link 
                href="/tires"
                className="bg-red-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-800"
              >
                Shop Tires
              </Link>
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-8">
            <Link 
              href="/blog"
              className="text-red-600 font-medium hover:text-red-700 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Blog
            </Link>
          </div>
        </article>
      </main>
    </>
  )
}
