import { RateLimiterRedis } from 'rate-limiter-flexible';
import { createClient } from 'redis';

async function run() {
  const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', err => console.log('Redis Client Error', err));
  await client.connect();
  console.log('Connected');
  
  const limiter = new RateLimiterRedis({
    storeClient: client,
    points: 10,
    duration: 1
  });
  
  // HOTFIX
  // @ts-ignore
  limiter.useRedis3AndLowerPackage = false;
  // @ts-ignore
  limiter.useRedisPackage = true;

  try {
    const res = await limiter.consume('test_key');
    console.log('Success:', res);
  } catch (err) {
    console.error('Error:', err);
  }
  await client.disconnect();
}
run();
