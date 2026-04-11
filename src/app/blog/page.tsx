import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getAllPosts, BlogPostMeta } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog | Warehouse Tire Direct',
  description: 'Expert advice on wheels, tires, and vehicle fitment. Learn about wheel sizing, tire care, lifted truck builds, and more from the pros at Warehouse Tire Direct.',
  alternates: {
    canonical: 'https://shop.warehousetiredirect.com/blog',
  },
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <article className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {post.image && (
        <Link href={`/blog/${post.slug}`}>
          <div className="relative h-48 w-full">
            <Image
              src={post.image}
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
        </Link>
      )}
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
            {post.category}
          </span>
          <span>•</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>•</span>
          <span>{post.readingTime} min read</span>
        </div>
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-xl font-bold text-gray-900 hover:text-red-600 mb-2">
            {post.title}
          </h2>
        </Link>
        <p className="text-gray-600 mb-4 line-clamp-2">
          {post.description}
        </p>
        <Link 
          href={`/blog/${post.slug}`}
          className="text-red-600 font-medium hover:text-red-700 inline-flex items-center gap-1"
        >
          Read More 
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  )
}

export default async function BlogPage() {
  const posts = await getAllPosts()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold font-oswald mb-4">
            Warehouse Tire Blog
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl">
            Expert advice on wheels, tires, fitment, and vehicle builds. Learn from the pros.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="container mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-700 mb-2">Coming Soon!</h2>
            <p className="text-gray-500">We're working on some great content. Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map(post => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
