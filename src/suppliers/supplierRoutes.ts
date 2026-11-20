import { Router, Request, Response } from 'express';
import { supplierAHotels, supplierBHotels } from './mockData';
import { SupplierHotel } from '../types/hotel';

const router = Router();
export const supplierHealth = {
  supplierA: true,
  supplierB: true,
};

function filterByCity(hotels: SupplierHotel[], cityQuery: unknown): SupplierHotel[] {
  if (typeof cityQuery !== 'string' || !cityQuery.trim()) {
    return hotels;
  }
  const normalized = cityQuery.trim().toLowerCase();
  return hotels.filter((h) => h.city.toLowerCase() === normalized);
}

router.get('/supplierA/hotels', (req: Request, res: Response) => {
  if (!supplierHealth.supplierA) {
    return res.status(503).json({ error: 'Supplier A is currently unavailable' });
  }
  return res.json(filterByCity(supplierAHotels, req.query.city));
});

router.get('/supplierB/hotels', (req: Request, res: Response) => {
  if (!supplierHealth.supplierB) {
    return res.status(503).json({ error: 'Supplier B is currently unavailable' });
  }
  return res.json(filterByCity(supplierBHotels, req.query.city));
});

router.post('/mock/toggle/:supplier', (req: Request, res: Response) => {
  const { supplier } = req.params;
  if (supplier !== 'supplierA' && supplier !== 'supplierB') {
    return res.status(400).json({ error: 'Use supplierA or supplierB' });
  }
  supplierHealth[supplier] = !supplierHealth[supplier];
  return res.json({
    supplier,
    status: supplierHealth[supplier] ? 'UP' : 'DOWN',
  });
});

export default router;