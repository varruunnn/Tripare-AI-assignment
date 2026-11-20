import 'dotenv/config';
import express from 'express';
import supplierRoutes from './suppliers/supplierRoutes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(supplierRoutes);

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});