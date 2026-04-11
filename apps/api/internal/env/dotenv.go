package env

import (
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// Load reads only the repository root .env (../../.env from apps/api).
// CWD must be apps/api when running go run ./cmd/server or cmd/migrate.
func Load() {
	repoRoot := filepath.Join("..", "..", ".env")
	if _, err := os.Stat(repoRoot); err != nil {
		return
	}
	_ = godotenv.Load(repoRoot)
}
