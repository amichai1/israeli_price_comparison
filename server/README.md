# Server (Backend)

The backend is a tRPC API server that connects to Supabase (PostgreSQL). It was scaffolded from a Manus template and adapted for this project.

## File Structure

```
server/
  routers.ts         ← tRPC route definitions (add API routes here)
  db.ts              ← Query helpers (add database functions here)
  storage.ts         ← S3 storage helpers
  _core/             ← Framework-level code (DO NOT modify)
```

**Important:** Do not edit files inside `_core/` directories — these are framework internals.

## Current Routes

| Route | Type | Description |
|-------|------|-------------|
| `auth.me` | query | Returns the current user (or null) |
| `auth.logout` | mutation | Clears the session cookie |
| `system.*` | various | System routes (notifications, health) |

## Supabase Connection

The mobile app connects directly to Supabase using the anon key. The server uses `DATABASE_URL` (MySQL/TiDB via Drizzle ORM) for its own user/auth tables, while Supabase is the primary data store for price data.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL/TiDB connection string (for Drizzle ORM) |
| `JWT_SECRET` | Session signing secret |
| `VITE_APP_ID` | OAuth app ID |

See the root `.env` for Supabase credentials used by the mobile app.
