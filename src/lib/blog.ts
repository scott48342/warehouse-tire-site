/**
 * Blog Utilities
 * 
 * Simple file-based blog system using MDX files.
 * Articles stored in src/content/blog/*.mdx
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog')

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  category: string
  tags: string[]
  image?: string
  content: string
  readingTime: number
}

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  author: string
  category: string
  tags: string[]
  image?: string
  readingTime: number
}

/**
 * Calculate reading time (words per minute)
 */
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

/**
 * Get all blog posts (metadata only)
 */
export async function getAllPosts(): Promise<BlogPostMeta[]> {
  if (!fs.existsSync(BLOG_DIR)) {
    return []
  }

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx') || f.endsWith('.md'))
  
  const posts = files.map(filename => {
    const slug = filename.replace(/\.mdx?$/, '')
    const filePath = path.join(BLOG_DIR, filename)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(fileContent)
    
    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      date: data.date || new Date().toISOString(),
      author: data.author || 'Warehouse Tire Team',
      category: data.category || 'General',
      tags: data.tags || [],
      image: data.image,
      readingTime: calculateReadingTime(content),
    }
  })

  // Sort by date (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/**
 * Get a single blog post by slug
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`)
  const mdPath = path.join(BLOG_DIR, `${slug}.md`)
  
  let filePath: string | null = null
  if (fs.existsSync(mdxPath)) filePath = mdxPath
  else if (fs.existsSync(mdPath)) filePath = mdPath
  
  if (!filePath) return null

  const fileContent = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(fileContent)

  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || new Date().toISOString(),
    author: data.author || 'Warehouse Tire Team',
    category: data.category || 'General',
    tags: data.tags || [],
    image: data.image,
    content,
    readingTime: calculateReadingTime(content),
  }
}

/**
 * Get posts by category
 */
export async function getPostsByCategory(category: string): Promise<BlogPostMeta[]> {
  const posts = await getAllPosts()
  return posts.filter(p => p.category.toLowerCase() === category.toLowerCase())
}

/**
 * Get posts by tag
 */
export async function getPostsByTag(tag: string): Promise<BlogPostMeta[]> {
  const posts = await getAllPosts()
  return posts.filter(p => p.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
}

/**
 * Get all unique categories
 */
export async function getAllCategories(): Promise<string[]> {
  const posts = await getAllPosts()
  const categories = new Set(posts.map(p => p.category))
  return Array.from(categories).sort()
}

/**
 * Get all unique tags
 */
export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPosts()
  const tags = new Set(posts.flatMap(p => p.tags))
  return Array.from(tags).sort()
}
