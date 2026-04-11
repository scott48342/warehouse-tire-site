/**
 * Get Next Blog Topic
 * 
 * Returns the next ungenerated topic from topics.json
 * Used by the AI agent to know what to write about
 * 
 * Usage: node get-next-topic.js
 */

const fs = require('fs');
const path = require('path');

const TOPICS_FILE = path.join(__dirname, 'topics.json');
const BLOG_DIR = path.join(__dirname, '../../src/content/blog');

function getNextTopic() {
  const data = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  
  // Get list of existing blog posts
  const existingSlugs = new Set(
    fs.readdirSync(BLOG_DIR)
      .filter(f => f.endsWith('.mdx'))
      .map(f => f.replace('.mdx', ''))
  );
  
  // Find first topic that hasn't been generated
  for (const topic of data.topics) {
    if (!existingSlugs.has(topic.slug) && !data.generated.includes(topic.slug)) {
      return topic;
    }
  }
  
  return null;
}

function markAsGenerated(slug) {
  const data = JSON.parse(fs.readFileSync(TOPICS_FILE, 'utf-8'));
  if (!data.generated.includes(slug)) {
    data.generated.push(slug);
  }
  data.lastGenerated = new Date().toISOString();
  fs.writeFileSync(TOPICS_FILE, JSON.stringify(data, null, 2));
}

// If run directly, output the next topic
if (require.main === module) {
  const topic = getNextTopic();
  if (topic) {
    console.log(JSON.stringify(topic, null, 2));
  } else {
    console.log('No more topics to generate');
  }
}

module.exports = { getNextTopic, markAsGenerated };
