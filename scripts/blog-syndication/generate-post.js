/**
 * Blog Post Generator
 * 
 * Auto-generates SEO-optimized blog posts from product/vehicle data.
 * Designed to work with AI assistance (Claude) for content generation.
 * 
 * Usage:
 *   node generate-post.js --topic="best all-terrain tires for trucks"
 *   node generate-post.js --type=vehicle --vehicle="2024 Ford F-150"
 *   node generate-post.js --type=product --category="mud tires"
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const BLOG_DIR = path.join(__dirname, '../../src/content/blog');
const BASE_URL = 'https://shop.warehousetiredirect.com';

// ============================================================================
// Blog Post Templates
// ============================================================================

const TEMPLATES = {
  // "Best X for Y" articles (highest SEO value)
  bestFor: {
    titleFormat: 'Best {product} for {vehicle} in {year}',
    structure: [
      'Introduction (why this matters)',
      'Quick Picks (top 3-5 products)',
      'Detailed Reviews',
      'How to Choose (buying guide)',
      'Installation Tips',
      'FAQ',
      'Conclusion with CTA',
    ],
  },
  
  // How-to guides
  howTo: {
    titleFormat: 'How to {action}: Complete Guide for {year}',
    structure: [
      'Introduction',
      'What You\'ll Need',
      'Step-by-Step Guide',
      'Common Mistakes to Avoid',
      'Pro Tips',
      'FAQ',
    ],
  },
  
  // Comparison articles
  comparison: {
    titleFormat: '{productA} vs {productB}: Which is Better for {use}?',
    structure: [
      'Quick Verdict',
      'Overview of Both',
      'Head-to-Head Comparison',
      'When to Choose A',
      'When to Choose B',
      'Final Recommendation',
    ],
  },
  
  // Vehicle-specific guides
  vehicleGuide: {
    titleFormat: '{year} {vehicle} Wheels & Tires Guide: Sizes, Options & Upgrades',
    structure: [
      'Factory Specs Overview',
      'Popular Upgrade Options',
      'Best Wheels for {vehicle}',
      'Best Tires for {vehicle}',
      'Lift Kit Options',
      'Package Deals',
      'FAQ',
    ],
  },
};

// High-value SEO topics
const SEO_TOPICS = [
  // Vehicle-specific (high search volume)
  'best tires for ford f-150',
  'best wheels for jeep wrangler',
  'best all-terrain tires for trucks',
  'best mud tires for trucks',
  'best highway tires for trucks',
  
  // How-to (good backlink potential)
  'how to read tire sizes',
  'how to choose wheel offset',
  'wheel bolt pattern guide',
  'tire speed rating explained',
  'tire load rating guide',
  
  // Comparison (high conversion)
  'all-terrain vs mud-terrain tires',
  'steel vs alloy wheels',
  '17 vs 18 inch wheels',
  
  // Seasonal (timely)
  'best winter tires 2026',
  'summer tire recommendations',
  'all-season tire guide',
];

// ============================================================================
// Content Generation (Outline Only)
// ============================================================================

/**
 * Generate a blog post outline
 * (The actual content should be written with AI assistance)
 */
function generateOutline(topic, template = 'bestFor') {
  const tmpl = TEMPLATES[template];
  const year = new Date().getFullYear();
  
  // Create slug from topic
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  
  const title = tmpl.titleFormat
    .replace('{year}', year)
    .replace('{product}', topic.includes('tire') ? 'Tires' : 'Wheels')
    .replace('{vehicle}', extractVehicle(topic) || 'Your Vehicle')
    .replace('{action}', topic);
  
  return {
    slug: `${slug}-${year}`,
    title,
    template,
    structure: tmpl.structure,
    keywords: extractKeywords(topic),
    internalLinks: suggestInternalLinks(topic),
    year,
  };
}

function extractVehicle(topic) {
  const vehicles = ['f-150', 'f150', 'wrangler', 'silverado', 'ram', 'tacoma', 'mustang', 'camaro'];
  for (const v of vehicles) {
    if (topic.toLowerCase().includes(v)) {
      return v.charAt(0).toUpperCase() + v.slice(1);
    }
  }
  return null;
}

function extractKeywords(topic) {
  const words = topic.toLowerCase().split(/\s+/);
  const keywords = new Set(words.filter(w => w.length > 3));
  
  // Add related keywords
  if (topic.includes('tire')) {
    keywords.add('tires');
    keywords.add('wheels');
    keywords.add('fitment');
  }
  if (topic.includes('wheel')) {
    keywords.add('rims');
    keywords.add('offset');
    keywords.add('bolt pattern');
  }
  if (topic.includes('truck')) {
    keywords.add('pickup');
    keywords.add('4x4');
  }
  
  return Array.from(keywords);
}

function suggestInternalLinks(topic) {
  const links = [];
  
  if (topic.includes('tire')) {
    links.push({ text: 'Shop Tires', url: '/tires' });
  }
  if (topic.includes('wheel')) {
    links.push({ text: 'Shop Wheels', url: '/wheels' });
  }
  links.push({ text: 'Wheel & Tire Packages', url: '/wheels?package=1' });
  
  return links;
}

// ============================================================================
// MDX File Creation
// ============================================================================

function createBlogPostFile(outline, content = null) {
  const frontmatter = `---
title: "${outline.title}"
description: "${outline.title}. Expert recommendations and buying guide."
date: "${new Date().toISOString().split('T')[0]}"
image: "/images/blog/${outline.slug}.jpg"
tags: ${outline.keywords.slice(0, 5).join(', ')}
author: "Warehouse Tire Direct"
---`;

  const placeholder = content || `
# ${outline.title}

> **Last Updated:** ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

## Introduction

[Write compelling intro - why readers should care about this topic]

${outline.structure.slice(1).map((section, i) => `
## ${section}

[Content for ${section}]
`).join('\n')}

## Ready to Upgrade?

Find the perfect ${outline.keywords.includes('tires') ? 'tires' : 'wheels'} for your vehicle:

${outline.internalLinks.map(l => `- [${l.text}](${l.url})`).join('\n')}

Or call us at **(248) 332-4120** for expert advice.
`;

  const filepath = path.join(BLOG_DIR, `${outline.slug}.mdx`);
  
  // Don't overwrite existing
  if (fs.existsSync(filepath)) {
    console.log(`⚠️  Post already exists: ${outline.slug}`);
    return null;
  }
  
  fs.writeFileSync(filepath, frontmatter + '\n' + placeholder);
  console.log(`✅ Created: ${filepath}`);
  
  return filepath;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const topicArg = args.find(a => a.startsWith('--topic='));
  const typeArg = args.find(a => a.startsWith('--type='));
  const listTopics = args.includes('--list');
  
  console.log('\n📝 Blog Post Generator\n');
  
  if (listTopics) {
    console.log('High-value SEO topics to consider:\n');
    SEO_TOPICS.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log('\nUsage: node generate-post.js --topic="your topic here"\n');
    return;
  }
  
  if (!topicArg) {
    console.log('Usage:');
    console.log('  node generate-post.js --topic="best mud tires for trucks"');
    console.log('  node generate-post.js --list  (show topic ideas)');
    console.log('\nThis creates an outline/placeholder. Write actual content with AI.\n');
    return;
  }
  
  const topic = topicArg.split('=').slice(1).join('=');
  const template = typeArg ? typeArg.split('=')[1] : 'bestFor';
  
  console.log(`Topic: ${topic}`);
  console.log(`Template: ${template}\n`);
  
  const outline = generateOutline(topic, template);
  
  console.log('Generated outline:');
  console.log(`  Title: ${outline.title}`);
  console.log(`  Slug: ${outline.slug}`);
  console.log(`  Keywords: ${outline.keywords.join(', ')}`);
  console.log(`\nStructure:`);
  outline.structure.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  
  console.log('\nCreating file...\n');
  createBlogPostFile(outline);
  
  console.log('\nNext steps:');
  console.log('1. Edit the MDX file with actual content');
  console.log('2. Add a hero image to /public/images/blog/');
  console.log('3. Run: node syndicate.js --slug=' + outline.slug);
  console.log('');
}

main();
