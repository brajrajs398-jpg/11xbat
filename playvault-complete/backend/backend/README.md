# PlayVault Local Backend

This is the local replacement for the Supabase backend used by PlayVault.

## Stack
- Node.js + Express
- PostgreSQL 16
- JWT authentication
- bcrypt password hashing

## Run

1. Install Node.js 20+ and Docker Desktop.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL:

```bash
docker compose up -d
```

4. Install dependencies:

```bash
npm install
```

5. Initialize the database:

```bash
npm run db:init
```

6. Start the API:

```bash
npm run dev
```

API: `http://localhost:4000`
Health: `http://localhost:4000/api/health`

## Frontend
Set the frontend `.env` to:

```env
VITE_API_URL=http://localhost:4000/api
```

## Note about game security
The existing PlayVault game UI calculates game outcomes in the browser. This backend securely owns authentication, balances and history, and balance changes are atomic. A fully cheat-resistant casino-style architecture would move each game's random outcome and settlement into dedicated server-side game endpoints; that is a separate phase from replacing Supabase.


## Running under heavy load

For production, use cluster mode instead of `npm start` — this uses every
CPU core instead of just one:

```bash
npm run build
npm run start:cluster
```

Tuning knobs (set in `.env`):
- `WEB_CONCURRENCY` — number of worker processes (default: all CPU cores)
- `DB_POOL_MAX` — Postgres connections per worker (default: 20). Keep
  `DB_POOL_MAX × WEB_CONCURRENCY` under your Postgres `max_connections`
  (default 100) — e.g. 4 workers × 20 = 80 is safe.

Also included: response compression, a general API rate limit (120 req/min
per IP) and a stricter limit on `/api/auth/*` (20 req/15min per IP), and
graceful shutdown so in-flight requests finish before restart/redeploy.

At real scale beyond a single machine, put a load balancer in front of
multiple instances (auth is stateless via JWT, so this needs no code
changes) and consider a managed Postgres with connection pooling
(e.g. PgBouncer) since the database — not the app server — becomes the
bottleneck first.
