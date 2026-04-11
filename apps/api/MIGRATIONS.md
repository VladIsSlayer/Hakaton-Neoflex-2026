# Database Migrations

Backend includes a lightweight migration runner at `cmd/migrate`.

## Requirements

- `DATABASE_URL` environment variable is required.
- Optional `MIGRATIONS_DIR` (default: `../../infra/postgres/migrations` when run from `apps/api`).

## Usage

From `apps/api` directory:

```powershell
go run ./cmd/migrate
```

Custom migrations directory:

```powershell
$env:MIGRATIONS_DIR = "../../infra/postgres/migrations"
go run ./cmd/migrate
```

## Notes

- Applied versions are recorded in `public.schema_migrations`.
- Migration files use naming format `<version>_<name>.sql`, e.g. `0002_add_index.sql`.
- Migrations run in ascending version order.
