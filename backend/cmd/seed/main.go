package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"time"

	"neoflex-lms/internal/config"
	"neoflex-lms/internal/env"
	"neoflex-lms/internal/store"
)

func main() {
	env.Load()
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pg, err := store.NewPostgres(ctx, cfg.DatabaseURL, store.PostgresOptions{
		MaxConns:         cfg.DBMaxConns,
		MinConns:         cfg.DBMinConns,
		MaxConnLifetime:  cfg.DBMaxConnLifetime,
		MaxConnIdleTime:  cfg.DBMaxConnIdleTime,
		HealthCheckEvery: cfg.DBHealthCheckEvery,
	})
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer pg.Close()

	path := resolveSeedFilePath(cfg.SeedJSONPath)
	if err := pg.SeedFromJSON(ctx, path); err != nil {
		log.Fatalf("seed: %v", err)
	}
	log.Printf("seed OK: %s", path)
}

func resolveSeedFilePath(primary string) string {
	if fi, err := os.Stat(primary); err == nil && !fi.IsDir() {
		return primary
	}
	alt := filepath.Join("backend", primary)
	if fi, err := os.Stat(alt); err == nil && !fi.IsDir() {
		return alt
	}
	return primary
}
