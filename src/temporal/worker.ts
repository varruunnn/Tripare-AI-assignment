import 'dotenv/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

import { TASK_QUEUE } from './client';

async function run() {
  const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  const connection = await NativeConnection.connect({ address });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  console.log(`[Worker] Connected to Temporal at ${address}, listening on "${TASK_QUEUE}"`);

  const shutdown = () => {
    console.log('[Worker] Shutting down...');
    worker.shutdown();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await worker.run();
  await connection.close();
}

run().catch((err) => {
  console.error('[Worker] Fatal error:', err);
  process.exit(1);
});