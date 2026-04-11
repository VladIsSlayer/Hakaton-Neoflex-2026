package env

import (
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// Load reads .env from repository root, then overlays apps/api/.env when present.
// CWD is expected to be apps/api when running go run ./cmd/server.
func Load() {
	repoRoot := filepath.Join("..", "..", ".env")
	if _, err := os.Stat(repoRoot); err == nil {
		_ = godotenv.Load(repoRoot)
	}
	if _, err := os.Stat(".env"); err == nil {
		_ = godotenv.Overload(".env")
	}
}
