# Mini Job Queue Dashboard

A small full-stack job queue dashboard: **NestJS + TypeORM + SQLite** backend,
**React (Vite)** frontend.

```
job-queue-dashboard/
├── backend/    NestJS API (SQLite via TypeORM)
└── frontend/   React dashboard (Vite)
```

## 1. Running it locally

Requires Node.js 18+.

### Backend

```bash
cd backend
npm install
npm run start:dev       # http://localhost:3000
```

A `job-queue.sqlite` file is created automatically in `backend/` on first run
(`synchronize: true` — see [Trade-offs](#4-assumptions-trade-offs--what-id-do-next)).
No environment variables are required to run locally; `PORT` and `DB_PATH`
are optional overrides.

### Frontend

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:3000
npm install
npm run dev              # http://localhost:5173
```

Open `http://localhost:5173`. Make sure the backend is running first (CORS
is open by default for this project).

## 2. API

| Method | Path                | Body                          | Notes |
|--------|----------------------|--------------------------------|-------|
| POST   | `/jobs`              | `{ title, type }`             | Creates a job with status `pending` |
| GET    | `/jobs`              | –                              | Optional `?status=pending\|running\|completed\|failed` |
| PATCH  | `/jobs/:id/status`   | `{ status }`                  | Validates the state-machine transition |
| DELETE | `/jobs/:id`          | –                              | 204 No Content |

`type` is restricted to a fixed list (`email`, `report`, `data-sync`,
`image-processing`, `other`) so the field can't silently drift into
inconsistent free-text values — easy to extend in
`backend/src/jobs/dto/create-job.dto.ts`.

Errors return a consistent JSON shape (`{ statusCode, error, message }`)
via Nest's built-in exception filters:

- `400` — malformed input (missing title, unknown `type`, invalid UUID, etc.)
- `404` — job not found
- `409` — invalid or conflicting status transition (see below)

## 3. The state machine & concurrency (the interesting part)

Allowed transitions:

```
pending → running → completed
              ↘ failed
pending → failed
```

`completed` and `failed` are terminal. This is enforced with a lookup table
in `backend/src/jobs/jobs.service.ts`:

```ts
const ALLOWED_TRANSITIONS = {
  pending:   [running, failed],
  running:   [completed, failed],
  completed: [],
  failed:    [],
};
```

### Where should this rule be enforced?

**On the backend, exclusively.** The React UI mirrors the same table
(`frontend/src/constants.js`) purely so it doesn't show a "Mark running"
button on a completed job — that's a UX nicety, not the enforcement
mechanism. The UI is not a trust boundary.

### What happens if someone bypasses the frontend and calls the API directly?

Nothing bad. `PATCH /jobs/:id/status` re-validates the transition against
the job's *current* status read from the database, not whatever the client
claims. `curl -X PATCH .../status -d '{"status":"running"}'` on a completed
job returns `409 Conflict` with a message describing which transitions are
actually allowed. Malformed status values are rejected at `400` by
`class-validator` before they even reach the service.

### What happens when two requests arrive at nearly the same time?

This is the core scenario in the brief: two browser tabs both see a job as
`pending` and both fire `PATCH .../status { status: "running" }` within
milliseconds of each other.

A naive implementation —

```ts
const job = await repo.findOne(id);       // both read "pending"
if (job.status !== 'pending') throw ...;  // both pass
job.status = 'running';
await repo.save(job);                     // both write "running" — "works",
                                           // but only by luck, and the
                                           // second write silently masks
                                           // that a race happened at all
```

— has a race window between the *read* and the *write*. Both requests can
pass the in-memory check before either one writes, especially under real
concurrency (multiple server instances, or just unlucky timing).

**Fix used here:** replace the read-then-write with a single **atomic
conditional UPDATE**, using the status we just read as part of the `WHERE`
clause:

```sql
UPDATE jobs SET status = 'running'
WHERE id = :id AND status = 'pending';
```

This statement is atomic in both SQLite and Postgres — the database (not
application code) serializes concurrent writers to the same row. If two
requests race:

- Exactly **one** `UPDATE` matches the row and affects 1 row → that request
  wins and returns `200` with the updated job.
- The other `UPDATE`'s `WHERE status = 'pending'` no longer matches (the row
  is now `running`) → **0 rows affected** → the service throws `409
  Conflict` ("Job status was changed by another request... please refresh").

No job ever ends up in two states, no lost updates, and the loser gets a
clear, actionable error instead of a silent no-op or a corrupted record.
This is implemented in `JobsService.updateStatus()` via TypeORM's
`createQueryBuilder().update()...where(...).andWhere(...)`, which is the
only place in the code that calls the ORM's row-locking-free "optimistic"
conditional write.

I deliberately avoided heavier machinery (Postgres `SELECT ... FOR UPDATE`
transactions, a Redis distributed lock, a message queue with per-job
sequencing) — the brief asked not to over-engineer this, and a single
atomic conditional UPDATE fully closes the race for a single-database
system like this one. If this were sharded across multiple databases or
needed cross-service coordination, that's when I'd reach for a real
distributed lock or a transactional outbox.

### How the frontend surfaces this

If a tab loses the race (gets a `409`), the UI shows the server's error
message in a toast and immediately **re-fetches jobs from the server**
rather than trusting its local optimistic state — so the tab that lost
self-corrects to reality instead of showing a job as "running" when it
isn't. There's also a light 5s poll so a *second* tab picks up changes made
in the first tab even without an explicit action, which is the more
realistic version of the "two tabs" scenario.

## 4. Assumptions, trade-offs & what I'd do next

- **SQLite over Postgres**: the brief allows either; SQLite means zero setup
  and the concurrency behavior described above is representative on
  Postgres too (the same conditional-`UPDATE` pattern works unchanged if
  `AppModule`'s TypeORM config is swapped to `postgres`).
- **`synchronize: true`**: TypeORM auto-creates the schema from the entity
  on boot. Fine for a take-home project; a real project would use
  versioned migrations (`typeorm migration:generate`) so schema changes are
  reviewable and reversible.
- **No auth**: out of scope per the brief. In a real system, job mutation
  endpoints (`PATCH`/`DELETE`) would require authentication, and I'd likely
  record `updatedBy` on status changes.
- **Polling instead of websockets**: a 5s poll is enough to demonstrate
  cross-tab consistency without adding a websocket layer. A production
  version would push updates (SSE or websockets) instead of polling.
- **No job execution engine**: this only manages job *records* and their
  status — nothing actually "runs" a job. Out of scope per the brief, but a
  natural next step (see bonus below).
- **`type` as a fixed enum-like list**: kept intentionally small and
  hardcoded rather than a free-text field, to keep the data consistent
  without adding a separate `job_types` table for a project this size.

### Bonus: what I'd add to make this more production-ready

**A row-level "reason" and structured audit trail on every status change**
(`job_status_history` table: `jobId, fromStatus, toStatus, changedAt`),
written in the same atomic operation as the status update. I chose this
over, say, adding retries/backoff or a real job runner because it directly
strengthens the exact problem the brief focuses on: **observability into
concurrent/conflicting state changes.** Right now a `409` conflict is
visible to the client in the moment but leaves no trace afterward — with a
history table, you could answer "who/what actually flipped this job to
`running`, and did anything else attempt to and fail?" after the fact,
which matters a lot once you have more than one worker or more than one
human touching the same queue.

## 5. Deployment

Not deployed in this submission — see the note in my submission message for
why, and the two commands below to do it in a few minutes:

- **Backend**: any Node host works (Render, Railway, Fly.io). Build with
  `npm run build`, start with `node dist/main.js`. Set `PORT` if required by
  the platform. SQLite file persistence requires a persistent disk/volume
  on most PaaS providers (or swap to a managed Postgres — just change the
  `type` in `AppModule`'s `TypeOrmModule.forRoot`).
- **Frontend**: any static host (Vercel, Netlify). Build with `npm run
  build`, set `VITE_API_URL` to the deployed backend URL, deploy the
  `dist/` folder.
