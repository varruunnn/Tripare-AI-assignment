import { Connection, Client } from '@temporalio/client';

export const TASK_QUEUE = 'hotel-offer-queue';

let cachedClient: Client | null = null;
let cachedConnection: Connection | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (cachedClient) {
    return cachedClient;
  }
  const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  cachedConnection = await Connection.connect({ address });
  cachedClient = new Client({ connection: cachedConnection, namespace: 'default' });
  return cachedClient;
}

export async function checkTemporalHealth(): Promise<boolean> {
  try {
    const client = await getTemporalClient();
    await client.connection.workflowService.getSystemInfo({});
    return true;
  } catch {
    return false;
  }
}