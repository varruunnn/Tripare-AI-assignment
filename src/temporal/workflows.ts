import { proxyActivities, log } from '@temporalio/workflow';
import type * as activities from './activities';
import { HotelOffer, SupplierHotel } from '../types/hotel';

const { fetchSupplierA, fetchSupplierB, saveOffersToRedis } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    initialInterval: '500ms',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export async function hotelOfferWorkflow(city: string): Promise<HotelOffer[]> {
  const normalizedCity = city.trim().toLowerCase();
  log.info('Starting hotelOfferWorkflow', { city: normalizedCity });
  const [resA, resB] = await Promise.allSettled([
    fetchSupplierA(normalizedCity),
    fetchSupplierB(normalizedCity),
  ]);

  if (resA.status === 'rejected' && resB.status === 'rejected') {
    log.error('Both suppliers failed', {
      supplierAError: String(resA.reason),
      supplierBError: String(resB.reason),
    });
    throw new Error('All hotel suppliers are currently unavailable');
  }

  const taggedHotels: Array<{ supplier: string; hotel: SupplierHotel }> = [];

  if (resA.status === 'fulfilled') {
    for (const hotel of resA.value) {
      taggedHotels.push({ supplier: 'Supplier A', hotel });
    }
  } else {
    log.warn('Supplier A failed; continuing with Supplier B only', {
      reason: String(resA.reason),
    });
  }

  if (resB.status === 'fulfilled') {
    for (const hotel of resB.value) {
      taggedHotels.push({ supplier: 'Supplier B', hotel });
    }
  } else {
    log.warn('Supplier B failed; continuing with Supplier A only', {
      reason: String(resB.reason),
    });
  }
  const bestOffers = new Map<string, HotelOffer>();

  for (const { supplier, hotel } of taggedHotels) {
    const key = hotel.name.trim().toLowerCase();
    const candidate: HotelOffer = {
      name: hotel.name.trim(),
      price: hotel.price,
      supplier,
      commissionPct: hotel.commissionPct,
    };

    const existing = bestOffers.get(key);
    if (!existing) {
      bestOffers.set(key, candidate);
      continue;
    }

    const isCheaper = candidate.price < existing.price;
    const isTieWithBetterCommission =
      candidate.price === existing.price && candidate.commissionPct > existing.commissionPct;

    if (isCheaper || isTieWithBetterCommission) {
      bestOffers.set(key, candidate);
    }
  }

  const deduplicated = Array.from(bestOffers.values()).sort((a, b) => a.price - b.price);
 await saveOffersToRedis(normalizedCity, deduplicated);

  log.info('Completed hotelOfferWorkflow', {
    city: normalizedCity,
    offerCount: deduplicated.length,
  });

  return deduplicated;
}