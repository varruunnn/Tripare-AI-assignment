import { log } from '@temporalio/activity';
import { SupplierHotel, HotelOffer } from '../types/hotel';
import { saveCityOffers } from '../redis/redisService';

const SUPPLIER_BASE_URL = process.env.SUPPLIER_BASE_URL || 'http://localhost:3000';

async function fetchFromSupplier(
  supplierPath: string,
  supplierName: string,
  city: string
): Promise<SupplierHotel[]> {
  const url = `${SUPPLIER_BASE_URL}/${supplierPath}/hotels?city=${encodeURIComponent(city)}`;
  log.info(`Fetching hotels from ${supplierName}`, { city, url });

  const response = await fetch(url);
  if (!response.ok) {
    const message = `${supplierName} responded with HTTP ${response.status}`;
    log.error(message, { city, status: response.status });
    throw new Error(message);
  }

  const data = (await response.json()) as SupplierHotel[];
  log.info(`Received ${data.length} hotels from ${supplierName}`, { city });
  return data;
}

export async function fetchSupplierA(city: string): Promise<SupplierHotel[]> {
  return fetchFromSupplier('supplierA', 'Supplier A', city);
}

export async function fetchSupplierB(city: string): Promise<SupplierHotel[]> {
  return fetchFromSupplier('supplierB', 'Supplier B', city);
}

export async function saveOffersToRedis(city: string, offers: HotelOffer[]): Promise<void> {
  log.info(`Saving ${offers.length} deduplicated offers to Redis`, { city });
  await saveCityOffers(city, offers);
}