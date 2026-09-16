# Mini Job Queue Dashboard

A small full-stack application for creating and managing jobs through a simple dashboard.

The project focuses on one important backend problem: **handling job status changes safely when multiple requests try to update the same job at the same time.**

## Live Demo

**Frontend:**  
https://job-queue-dashboard-b8e8druf3-mansia13s-projects.vercel.app 

**Backend API:**  
https://job-queue-dashboard-7qh9.onrender.com/jobs
> Open the **Frontend** link to use the dashboard. The backend URL is the API used by the frontend.

## Tech Stack

**Frontend:** React, Vite
**Backend:** NestJS, TypeORM
**Database:** SQLite
**Validation:** class-validator

## Project Structure

```text
job-queue-dashboard/
├── backend/     # NestJS API + SQLite
└── frontend/    # React dashboard
```

## Features

* Create and view jobs
* Filter jobs by status
* Move jobs through valid states
* Delete jobs
* Validate API input
* Prevent invalid status transitions
* Handle concurrent status updates safely
* Automatically refresh the dashboard
* Show clear error messages when an update loses a race

## How the Job Flow Works

Each job follows a simple state machine:

```text
pending → running → completed
              ↘ failed

pending → failed
```

Once a job reaches `completed` or `failed`, it cannot be moved to another state.

The backend is responsible for enforcing these rules. The frontend only reflects them in the UI.

## The Interesting Part: Concurrent Updates

The main technical challenge in this project is what happens when **two requests try to update the same job at almost the same time**.

For example, imagine a job is currently:

```text
pending
```

Two browser tabs both try to change it to:

```text
running
```

A simple implementation might first read the job, check its status, and then update it:

```text
read job
↓
check status
↓
update job
```

The problem is that both requests could read `pending` before either request performs the update.

### The approach used

Instead of relying only on application-level checks, the backend performs the status change using an **atomic conditional UPDATE**:

```sql
UPDATE jobs
SET status = 'running'
WHERE id = :id AND status = 'pending';
```

The database decides which request succeeds.

If two requests race:

* One request updates the row successfully.
* The other request finds that the status is no longer `pending`.
* The second request receives a `409 Conflict`.
* The frontend then fetches the latest data from the server.

This means the application doesn't silently accept conflicting updates.

The important part is that the database condition is based on the **current status stored in the database**, rather than trusting the state held by the browser.

## API

| Method | Endpoint               | Purpose               |
| ------ | ---------------------- | --------------------- |
| POST   | `/jobs`                | Create a job          |
| GET    | `/jobs`                | Get all jobs          |
| GET    | `/jobs?status=pending` | Filter jobs by status |
| PATCH  | `/jobs/:id/status`     | Update job status     |
| DELETE | `/jobs/:id`            | Delete a job          |

Example job:

```json
{
  "title": "Generate monthly report",
  "type": "report"
}
```

Supported job types:

```text
email
report
data-sync
image-processing
other
```

Invalid input is rejected by the backend rather than relying on the frontend to validate it.

## Running Locally

Requires **Node.js 18+**.

### Backend

```bash
cd backend
npm install
npm run start:dev
```

Backend runs at:

```text
http://localhost:3000
```

SQLite is created automatically when the backend starts.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

If required, create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:3000
```

Make sure the backend is running before opening the frontend.

## Handling Multiple Tabs

The dashboard uses two simple mechanisms to keep the UI in sync.

### Server response after an update

When a status update succeeds, the UI uses the server response.

If the request receives a `409 Conflict`, the frontend shows the error and fetches the latest jobs again.

### Periodic refresh

The dashboard polls the backend every 5 seconds.

This means if one browser tab changes a job, another open tab will eventually reflect the updated state as well.

For a small project, this keeps the implementation simple without introducing WebSockets.

## Design Decisions

### Why SQLite?

SQLite keeps the project easy to run and review because there is no separate database setup.

The same conditional update approach can also be used with PostgreSQL if the application is moved to a production database.

### Why enforce transitions on the backend?

The frontend cannot be trusted to enforce business rules.

Someone could directly call:

```text
PATCH /jobs/:id/status
```

without using the React application.

The backend therefore validates every transition independently.

### Why no authentication?

Authentication was kept outside the scope of this project.

In a production system, job mutation endpoints would require authentication and status changes could also record which user or worker made the change.

### Why polling instead of WebSockets?

Polling every 5 seconds is enough for this dashboard and keeps the project lightweight.

For a production system with many jobs or users, I would consider **WebSockets or Server-Sent Events** for real-time updates.

### Why isn't there a real job worker?

This project focuses on **job management and state consistency**, not job execution.

A real production queue could connect this dashboard to workers that actually process jobs, with retry policies, backoff, and failure handling.

## What I'd Add Next

One feature I'd add next is a **job status history**.

For every status change, the system could store:

```text
jobId
fromStatus
toStatus
changedAt
changedBy
```

This would make it possible to answer questions such as:

* When did this job start running?
* Who changed its status?
* How many times did it fail?
* What happened before a conflict occurred?

It would also make the system much easier to debug once multiple workers or users are involved.

## Deployment

The project is deployed as two separate services:

### Frontend — Vercel

The React/Vite frontend is deployed on Vercel.

**Live application:** https://job-queue-dashboard-b8e8druf3-mansia13s-projects.vercel.app 

The frontend uses the following environment variable:

```env
VITE_API_URL= https://job-queue-dashboard-7qh9.onrender.com
```

### Backend — Render

The NestJS API is deployed on Render.

**Live API:** https://job-queue-dashboard-7qh9.onrender.com/jobs

The API endpoints are available under:

```text
GET    /jobs
POST   /jobs
PATCH  /jobs/:id/status
DELETE /jobs/:id
```

The frontend communicates with this backend API to create, update, retrieve, and delete jobs.

