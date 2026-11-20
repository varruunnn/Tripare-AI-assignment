import 'dotenv/config';
import express from 'express';
import supplierRoutes from './suppliers/supplierRoutes';
import hotelRoutes from './api/hotelRoutes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(supplierRoutes);
app.use(hotelRoutes);

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});