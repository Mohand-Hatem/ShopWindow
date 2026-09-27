import { PrismaClient, ProductStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Computers & Accessories', slug: 'computers-accessories' },
  { name: 'Audio & Sound', slug: 'audio-sound' },
  { name: 'Home Appliances', slug: 'home-appliances' },
  { name: 'Smart Home & IoT', slug: 'smart-home-iot' },
  { name: 'Gaming & VR', slug: 'gaming-vr' },
  { name: 'Photography & Video', slug: 'photography-video' },
  { name: 'Wearables & Fitness', slug: 'wearables-fitness' },
];

const ADJECTIVES = ['Ultra', 'Pro', 'Studio', 'Compact', 'Wireless', 'Smart', 'Elite', 'Eco', 'Ergonomic', 'Precision'];
const NOUNS = [
  'Headphones', 'Earbuds', 'Monitor', 'Keyboard', 'Mouse', 'Webcam', 'Speaker',
  'Microphone', 'Charger', 'Power Bank', 'Router', 'Hub', 'SSD Drive', 'Smartwatch',
  'Fitness Tracker', 'Robot Vacuum', 'Air Purifier', 'LED Lamp', 'Thermostat', 'Action Camera'
];
const BRANDS = ['Apex', 'Nova', 'Vanguard', 'Lumina', 'EchoTech', 'Zenith', 'Hyperion', 'Aero'];

async function main() {
  console.log('--- Seeding ShopWindow Database (Supabase) ---');

  // 1. Clean existing records in reverse dependency order
  console.log('Cleaning old data...');
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // 2. Seed Users
  console.log('Seeding initial users...');
  await prisma.user.createMany({
    data: [
      { email: 'admin@shopwindow.dev', role: Role.ADMIN },
      { email: 'customer@shopwindow.dev', role: Role.VIEWER },
    ],
  });

  // 3. Seed Categories
  console.log('Seeding 8 categories...');
  const createdCategories: { id: string; name: string; slug: string }[] = [];
  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: cat,
    });
    createdCategories.push(created);
  }

  // 4. Seed 520 Products
  console.log('Generating 520 realistic products across categories...');
  const productsData: Array<{
    sku: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    currency: string;
    categoryId: string;
    status: ProductStatus;
    stock: number;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const totalProducts = 520;
  for (let i = 1; i <= totalProducts; i++) {
    const category = createdCategories[(i - 1) % createdCategories.length];
    const brand = BRANDS[i % BRANDS.length];
    const adj = ADJECTIVES[i % ADJECTIVES.length];
    const noun = NOUNS[i % NOUNS.length];
    
    const name = `${brand} ${adj} ${noun} ${100 + i}`;
    const slug = `${brand.toLowerCase()}-${adj.toLowerCase()}-${noun.toLowerCase().replace(/\s+/g, '-')}-${100 + i}`;
    const sku = `SKU-${category.slug.slice(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`;
    
    // Deterministic price: $19.99 to $1499.99
    const basePrice = 19.99 + ((i * 17) % 1450);
    const price = Math.round(basePrice * 100) / 100;
    
    // 95% ACTIVE, 5% ARCHIVED to test status filtering
    const status = i % 20 === 0 ? ProductStatus.ARCHIVED : ProductStatus.ACTIVE;
    const stock = (i * 7) % 180 + 5; // Stock between 5 and 184
    
    // Spread dates across past 60 days
    const daysAgo = i % 60;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const updatedAt = new Date(createdAt.getTime() + (i % 24) * 60 * 60 * 1000);

    productsData.push({
      sku,
      name,
      slug,
      description: `High-performance ${name.toLowerCase()} engineered for reliability and sleek modern aesthetics. Features premium components, low energy consumption, and high durability.`,
      price,
      currency: 'USD',
      categoryId: category.id,
      status,
      stock,
      createdAt,
      updatedAt,
    });
  }

  // Insert in chunks of 100 for network efficiency over cloud pooler
  const chunkSize = 100;
  for (let i = 0; i < productsData.length; i += chunkSize) {
    const chunk = productsData.slice(i, i + chunkSize);
    await prisma.product.createMany({
      data: chunk,
    });
    console.log(`Inserted products ${i + 1} to ${Math.min(i + chunkSize, productsData.length)}...`);
  }

  console.log('✅ Seed completed successfully!');
  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  console.log(`Final Database Counts: ${categoryCount} Categories, ${productCount} Products.`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
