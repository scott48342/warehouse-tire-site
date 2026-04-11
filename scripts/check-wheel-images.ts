import { db } from '../src/db';
import { wheels } from '../src/db/schema';
import { sql, count } from 'drizzle-orm';

async function run() {
  const [result] = await db.select({
    total: count(),
    withImage: sql<number>`COUNT(*) FILTER (WHERE image_url IS NOT NULL)`,
    inStock: sql<number>`COUNT(*) FILTER (WHERE quantity > 0)`,
    imageAndStock: sql<number>`COUNT(*) FILTER (WHERE image_url IS NOT NULL AND quantity > 0)`
  }).from(wheels);
  
  console.log('Total wheels:', result.total);
  console.log('With image:', result.withImage);
  console.log('In stock (qty > 0):', result.inStock);
  console.log('Image + in stock:', result.imageAndStock);
  process.exit(0);
}
run();
