package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type migrationFile struct {
	version int64
	name    string
	path    string
	sql     string
}

func main() {
	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	migrationsDir := strings.TrimSpace(os.Getenv("MIGRATIONS_DIR"))
	if migrationsDir == "" {
		migrationsDir = "../db/migrations"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("ping postgres: %v", err)
	}

	files, err := loadMigrationFiles(migrationsDir)
	if err != nil {
		log.Fatalf("load migrations: %v", err)
	}
	if len(files) == 0 {
		log.Println("no migration files found")
		return
	}

	if err := ensureMigrationsTable(ctx, pool); err != nil {
		log.Fatalf("ensure migrations table: %v", err)
	}

	applied, err := loadAppliedVersions(ctx, pool)
	if err != nil {
		log.Fatalf("load applied migrations: %v", err)
	}

	appliedCount := 0
	for _, m := range files {
		if _, ok := applied[m.version]; ok {
			continue
		}
		if err := applyMigration(ctx, pool, m); err != nil {
			log.Fatalf("apply migration %s: %v", m.name, err)
		}
		appliedCount++
		log.Printf("applied migration %s", m.name)
	}

	if appliedCount == 0 {
		log.Println("database is up to date")
		return
	}
	log.Printf("applied %d migrations", appliedCount)
}

func loadMigrationFiles(dir string) ([]migrationFile, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]migrationFile, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".sql") {
			continue
		}
		version, err := parseVersion(e.Name())
		if err != nil {
			return nil, err
		}
		path := filepath.Join(dir, e.Name())
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		out = append(out, migrationFile{
			version: version,
			name:    e.Name(),
			path:    path,
			sql:     string(raw),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].version == out[j].version {
			return out[i].name < out[j].name
		}
		return out[i].version < out[j].version
	})
	for i := 1; i < len(out); i++ {
		if out[i].version == out[i-1].version {
			return nil, fmt.Errorf("duplicate migration version %d in %s and %s", out[i].version, out[i-1].name, out[i].name)
		}
	}
	return out, nil
}

func parseVersion(name string) (int64, error) {
	base := strings.TrimSuffix(name, filepath.Ext(name))
	parts := strings.SplitN(base, "_", 2)
	if len(parts) < 2 {
		return 0, fmt.Errorf("invalid migration filename %q (expected <version>_<name>.sql)", name)
	}
	v, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || v <= 0 {
		return 0, fmt.Errorf("invalid migration version in %q", name)
	}
	return v, nil
}

func ensureMigrationsTable(ctx context.Context, pool *pgxpool.Pool) error {
	const q = `
CREATE TABLE IF NOT EXISTS public.schema_migrations (
	version bigint PRIMARY KEY,
	name text NOT NULL,
	applied_at timestamptz NOT NULL DEFAULT now()
)`
	_, err := pool.Exec(ctx, q)
	return err
}

func loadAppliedVersions(ctx context.Context, pool *pgxpool.Pool) (map[int64]struct{}, error) {
	rows, err := pool.Query(ctx, `SELECT version FROM public.schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]struct{}{}
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out[v] = struct{}{}
	}
	return out, rows.Err()
}

func applyMigration(ctx context.Context, pool *pgxpool.Pool, m migrationFile) error {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, m.sql); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO public.schema_migrations (version, name) VALUES ($1, $2)`, m.version, m.name); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
