import { saveCityOffers, getFilteredOffersFromRedis } from './src/redis/redisService';
import { redis } from './src/redis/redisClient';

async function test() {
  await saveCityOffers('delhi', [
    { name: 'Holtin', price: 5340, supplier: 'Supplier B', commissionPct: 20 },
    { name: 'Radison', price: 5900, supplier: 'Supplier A', commissionPct: 13 },
    { name: 'ITC Maurya', price: 8000, supplier: 'Supplier B', commissionPct: 22 }
  ]);

  const filtered = await getFilteredOffersFromRedis('delhi', 5500, 8500);
  console.log('Filtered (5500-8500):', filtered);
  await redis.quit();
}

test();