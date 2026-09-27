import * as dotenv from 'dotenv';
import * as path from 'path';
import { Client } from 'pg';
import Redis from 'ioredis';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testConnections() {
  console.log('--- Testing System Connections ---');

  // 1. Test Redis
  console.log('\n[1/2] Testing Redis connection...');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 5000,
  });

  try {
    const pong = await redis.ping();
    console.log(`[Redis] Connection SUCCESS! Ping response: ${pong}`);
    await redis.quit();
  } catch (err: any) {
    console.error(`[Redis] Connection FAILED: ${err.message}`);
  }

  // 2. Test Supabase DATABASE_URL
  console.log('\n[2/2] Testing Supabase connection (DATABASE_URL)...');
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      const res = await client.query('SELECT current_database(), current_user;');
      console.log(`[DATABASE_URL] Connection SUCCESS! DB: ${res.rows[0].current_database}, User: ${res.rows[0].current_user}`);
      await client.end();
    } catch (err: any) {
      console.error(`[DATABASE_URL] Connection FAILED: ${err.message}`);
    }
  }

  // 3. Test Supabase DIRECT_URL
  console.log('\n[3/3] Testing Supabase connection (DIRECT_URL)...');
  const directUrl = process.env.DIRECT_URL;
  if (directUrl) {
    const client = new Client({
      connectionString: directUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      const res = await client.query('SELECT current_database(), current_user;');
      console.log(`[DIRECT_URL] Connection SUCCESS! DB: ${res.rows[0].current_database}, User: ${res.rows[0].current_user}`);
      await client.end();
    } catch (err: any) {
      console.error(`[DIRECT_URL] Connection FAILED: ${err.message}`);
    }
  }

  console.log('\n--- Connectivity Checks Complete ---');
}

testConnections();
