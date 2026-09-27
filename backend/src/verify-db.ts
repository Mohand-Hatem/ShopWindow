import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function verify() {
  console.log('--- Verifying Supabase Database (Phase 1) ---');

  const [userCount, categoryCount, productCount, activeCount, archivedCount] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count({ where: { status: 'ARCHIVED' } }),
  ]);

  console.log(`\nEntity Counts:`);
  console.log(`- Users: ${userCount}`);
  console.log(`- Categories: ${categoryCount}`);
  console.log(`- Products Total: ${productCount}`);
  console.log(`  - Active: ${activeCount}`);
  console.log(`  - Archived: ${archivedCount}`);

  // Sample category with products
  const sampleCat = await prisma.category.findFirst({
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
  console.log(`\nSample Category: "${sampleCat?.name}" (${sampleCat?.slug}) - ${sampleCat?._count.products} products`);

  // Sample active product
  const sampleProd = await prisma.product.findFirst({
    where: { status: 'ACTIVE' },
    include: { category: true },
  });
  console.log(`\nSample Product:`);
  console.log(`- SKU: ${sampleProd?.sku}`);
  console.log(`- Name: ${sampleProd?.name}`);
  console.log(`- Slug: ${sampleProd?.slug}`);
  console.log(`- Price: $${sampleProd?.price} ${sampleProd?.currency}`);
  console.log(`- Stock: ${sampleProd?.stock}`);
  console.log(`- Category: ${sampleProd?.category.name}`);

  // Query PostgreSQL indexes on 'products' table
  const indexes: any[] = await prisma.$queryRaw`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'products' 
    ORDER BY indexname;
  `;

  console.log(`\nRegistered Indexes on 'products' table:`);
  indexes.forEach((idx) => console.log(`  ✓ ${idx.indexname}`));

  console.log('\n--- Phase 1 Database Verification Complete ---');
}

verify()
  .catch((e) => {
    console.error('Verification failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
