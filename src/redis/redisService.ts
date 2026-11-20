import { redis } from './redisClient';
import { HotelOffer } from '../types/hotel';

const DEFAULT_TTL_SECONDS = 300; 
function getKeys(city: string) {
  const normalizedCity = city.trim().toLowerCase();
  return {
    priceKey: `hotels:price:${normalizedCity}`,
    detailsKey: `hotels:details:${normalizedCity}`,
  };
}
export async function saveCityOffers(
  city: string,
  offers: HotelOffer[],
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const { priceKey, detailsKey } = getKeys(city);
  const pipeline = redis.multi();
 pipeline.del(priceKey, detailsKey);

  if (offers.length > 0) {
    const zsetArgs: (string | number)[] = [];
    const hashFields: Record<string, string> = {};

    for (const offer of offers) {
      const memberKey = offer.name.trim().toLowerCase();
      zsetArgs.push(offer.price, memberKey);
      hashFields[memberKey] = JSON.stringify(offer);
    }

    pipeline.zadd(priceKey, ...zsetArgs);
    pipeline.hset(detailsKey, hashFields);
    pipeline.expire(priceKey, ttlSeconds);
    pipeline.expire(detailsKey, ttlSeconds);
  }

  await pipeline.exec();
}
export async function getFilteredOffersFromRedis(
  city: string,
  minPrice?: number,
  maxPrice?: number
): Promise<HotelOffer[] | null> {
  const { priceKey, detailsKey } = getKeys(city);

  const exists = await redis.exists(priceKey);
  if (!exists) {
    return null; 
  }
  const min = minPrice !== undefined ? minPrice : '-inf';
  const max = maxPrice !== undefined ? maxPrice : '+inf';
  const matchingKeys = await redis.zrangebyscore(priceKey, min, max);
  if (matchingKeys.length === 0) {
    return [];
  }

  const rawOffers = await redis.hmget(detailsKey, ...matchingKeys);
  return rawOffers
    .filter((item): item is string => item !== null)
    .map((item) => JSON.parse(item) as HotelOffer);
}
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}