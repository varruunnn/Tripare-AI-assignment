
# Tripare-AI-assignment

A containerized **Node.js (TypeScript)** backend service that aggregates hotel offers from two mock suppliers in parallel using **Temporal.io**, deduplicates listings for the best offer, caches them in **Redis**, and runs price-range filtering directly inside Redis.

---

## What Makes This Implementation Different

- **In-Redis Price Filtering (`ZSET` + `HASH`):** Instead of caching a JSON blob and filtering in Node.js, deduplicated offers are written atomically (`MULTI`) to a Redis Sorted Set (`hotels:price:<city>`, scored by price) and a Hash (`hotels:details:<city>`) with a 5-minute TTL. Price filters execute inside Redis via `ZRANGEBYSCORE` + `HMGET` in `O(log N + M)` time.
- **Resilient Temporal Orchestration:** Supplier activities run in parallel with `Promise.allSettled`, explicit timeouts, and exponential-backoff retries (up to 3 attempts). If one supplier goes down, the workflow degrades gracefully and still returns results from the healthy supplier.
- **Business-Aware Deduplication:** Hotel names are normalized (`trim().toLowerCase()`) before comparison. Lower price wins; on an exact price tie (e.g., `ITC Maurya` at `8000`), the tie-breaker selects the higher `commissionPct` (`Supplier B` at `22%` over `Supplier A` at `15%`).
- **Built-in Chaos Toggle:** `POST /mock/toggle/supplierA` (or `supplierB`) toggles a supplier between `UP` and `DOWN` (`503`) at runtime so outage fallback can be tested without restarting containers.
- **Deep Health Check (`GET /health`):** Actively checks Supplier A, Supplier B, Redis (`PING`), and Temporal (`getSystemInfo`), returning `200 OK` (`UP`) or `503 Service Unavailable` (`DEGRADED`).
- **Decoupled Docker Compose Stack:** Runs `api`, `worker`, `redis`, and `temporal` (with Web UI) together in a single command.

---

## How to Run

**Prerequisites:** Docker Desktop (or Docker Engine with Compose v2).

```bash
git clone https://github.com/varruunnn/Tripare-AI-assignment
cd Tripare-AI-assignment
docker compose up --build
```

Once running:

- **API & Health Check:** `http://localhost:3000/health`
- **Temporal Web UI:** `http://localhost:8233`

To stop all services:

```bash
docker compose down
```

## Endpoints

| **Method** | **Endpoint**                                         | **Description**                                                                    |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET`      | `/api/hotels?city=delhi`                             | Triggers Temporal workflow to fetch, deduplicate, and cache offers                 |
| `GET`      | `/api/hotels?city=delhi&minPrice=5500&maxPrice=8500` | Filters cached offers directly inside Redis (populates via workflow on cache miss) |
| `GET`      | `/health`                                            | Checks Supplier A, Supplier B, Redis, and Temporal status                          |
| `GET`      | `/supplierA/hotels?city=delhi`                       | Mock Supplier A listings (same for `/supplierB/hotels`)                            |
| `POST`     | `/mock/toggle/supplierA`                             | Toggles Supplier A `UP`/`DOWN` for failure testing (same for `supplierB`)          |

## Testing with Postman

1. Make sure the stack is running via `docker compose up --build`.
2. Open **Postman**, click **Import** (top-left), and select `tripare-AI-assignment.postman_collection.json`.
3. Open the imported collection, click the **`...`** menu → **Run collection** → **Run** to execute all automated tests in sequence:
   - Health check (`200 UP`)
   - Valid city with overlaps & commission tie-breaker (`city=delhi`)
   - In-Redis price-range filter (`minPrice=5500&maxPrice=8500`)
   - City with no results (`city=bangalore` → `[]`)
   - Chaos failover: toggles Supplier A `DOWN` → `/health` returns `503 DEGRADED` → `/api/hotels?city=delhi` still returns `200 OK` from Supplier B → restores Supplier A `UP`
