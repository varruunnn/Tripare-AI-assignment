import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getTemporalClient, checkTemporalHealth, TASK_QUEUE } from '../temporal/client';
import { hotelOfferWorkflow } from '../temporal/workflows';
import { getFilteredOffersFromRedis, checkRedisHealth } from '../redis/redisService';

const router = Router();
const SUPPLIER_BASE_URL = process.env.SUPPLIER_BASE_URL || 'http://localhost:3000';

router.get('/api/hotels', async (req: Request, res: Response) => {
  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  if (!city) {
    return res.status(400).json({ error: 'Query parameter "city" is required' });
  }

  const hasMin = req.query.minPrice !== undefined && req.query.minPrice !== '';
  const hasMax = req.query.maxPrice !== undefined && req.query.maxPrice !== '';
  const minPrice = hasMin ? Number(req.query.minPrice) : undefined;
  const maxPrice = hasMax ? Number(req.query.maxPrice) : undefined;

  if ((minPrice !== undefined && Number.isNaN(minPrice)) || (maxPrice !== undefined && Number.isNaN(maxPrice))) {
    return res.status(400).json({ error: 'minPrice and maxPrice must be valid numbers' });
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return res.status(400).json({ error: 'minPrice cannot be greater than maxPrice' });
  }

  try {
    if (minPrice !== undefined || maxPrice !== undefined) {
      let filtered = await getFilteredOffersFromRedis(city, minPrice, maxPrice);
        if (filtered === null) {
        const client = await getTemporalClient();
        await client.workflow.execute(hotelOfferWorkflow, {
          taskQueue: TASK_QUEUE,
          workflowId: `hotel-offer-${city.toLowerCase()}-${randomUUID()}`,
          args: [city],
        });
        filtered = (await getFilteredOffersFromRedis(city, minPrice, maxPrice)) ?? [];
      }

      return res.json(filtered);
    }
    const client = await getTemporalClient();
    const offers = await client.workflow.execute(hotelOfferWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `hotel-offer-${city.toLowerCase()}-${randomUUID()}`,
      args: [city],
    });

    return res.json(offers);
  } catch (err) {
    console.error('[API] /api/hotels failed:', err);
    return res.status(503).json({
      error: 'Failed to fetch hotel offers',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

async function pingSupplier(path: string): Promise<'UP' | 'DOWN'> {
  try {
    const res = await fetch(`${SUPPLIER_BASE_URL}/${path}/hotels?city=delhi`);
    return res.ok ? 'UP' : 'DOWN';
  } catch {
    return 'DOWN';
  }
}

router.get('/health', async (_req: Request, res: Response) => {
  const [supplierA, supplierB, redisOk, temporalOk] = await Promise.all([
    pingSupplier('supplierA'),
    pingSupplier('supplierB'),
    checkRedisHealth(),
    checkTemporalHealth(),
  ]);

  const allHealthy = supplierA === 'UP' && supplierB === 'UP' && redisOk && temporalOk;

  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'UP' : 'DEGRADED',
    suppliers: {
      supplierA,
      supplierB,
    },
    dependencies: {
      redis: redisOk ? 'UP' : 'DOWN',
      temporal: temporalOk ? 'UP' : 'DOWN',
    },
  });
});

export default router;