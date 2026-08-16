import 'dotenv/config';
import cluster from 'node:cluster';
import os from 'node:os';

// Node.js runs each process on a single CPU core. Under heavy load, a single
// process becomes the bottleneck even if the machine has many cores.
// This forks one worker per CPU core, and the OS load-balances incoming
// connections across them automatically.
//
// Use this instead of `server.ts` directly in production:
//   npm run build && npm run start:cluster
//
// Workers are stateless (JWT auth, no in-memory session/game state), so
// this scales safely with no code changes needed elsewhere.

const numWorkers = Number(process.env.WEB_CONCURRENCY ?? os.cpus().length);

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${numWorkers} worker(s)...`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} died (code=${code} signal=${signal}). Restarting...`);
    cluster.fork();
  });
} else {
  // Each worker independently imports and starts the Express app + its own
  // DB pool (sized via DB_POOL_MAX, which should account for worker count —
  // e.g. DB_POOL_MAX=10 with 4 workers = up to 40 total DB connections).
  await import('./server.js');
}
