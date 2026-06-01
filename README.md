# DB Viewer

A lightweight, fast PostgreSQL administration tool similar to Drizzle Studio, built with Next.js. Connect with a standard URI, browse tables, edit data safely, and run SQL without JDBC overhead or credential persistence.

## Features

- **PostgreSQL URI connection:** `postgresql://user:pass@host:port/database`
- **In-memory sessions:** credentials are never written to disk
- **Connection pooling:** bounded pools per session (max 5 connections)
- **Table browser:** search, pagination (10/50/100/500), sort, filter
- **CRUD with confirmations:** insert, update, delete require explicit approval
- **Read-only mode:** safe access for production databases
- **SQL console:** Monaco editor, query history, execution time, CSV/JSON export
- **Light and dark themes:** toggle in the header
- **Safety checks:** destructive SQL detection, query timeouts, result limits

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your PostgreSQL connection URI.

### Example URI

```
postgresql://postgres:password@localhost:5432/mydb
```

### Environment (optional)

You can pre-fill a URI in the UI from an env var in development:

```env
# .env.local (not committed, for your convenience only)
NEXT_PUBLIC_DEFAULT_DB_URI=postgresql://...
```

> **Security:** Connection strings are held in server memory for the session only. Disconnect or close the browser tab to end the session (session ID is stored in `sessionStorage`).

## Tech Stack

- Next.js 16 (App Router)
- TypeScript, Tailwind CSS
- `pg` (node-postgres) with connection pooling
- TanStack Query & Table
- Monaco Editor, React Hook Form, Zod
- shadcn-style UI components

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/connect` | Connect and create pool |
| GET | `/api/connect` | Connection status |
| DELETE | `/api/connect` | Disconnect |
| GET | `/api/tables` | List tables |
| GET | `/api/tables/:name/schema` | Table schema |
| GET/POST/PUT/DELETE | `/api/tables/:name/data` | Paginated CRUD |
| POST | `/api/query` | Execute SQL |

All authenticated requests send header: `X-Connection-Id: <session-id>`.

## Safety

- Query timeout (default 30s, configurable)
- Result limit (default 1000, max 10000)
- Read-only mode blocks writes
- Destructive SQL requires confirmation
- CRUD operations use parameterized queries
- Tables without primary keys cannot be updated/deleted via UI

## Project Structure

```
src/
├── app/
│   ├── api/          # connect, tables, query
│   └── dashboard/    # main UI
├── components/
│   ├── database/     # connection form
│   ├── tables/       # list, grid, schema
│   ├── sql-console/  # Monaco SQL editor
│   └── forms/        # row editor, JSON editor
├── lib/              # database, validation, sql-safety
└── types/
```

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run start    # production server
npm run lint     # ESLint
```

## License

MIT
