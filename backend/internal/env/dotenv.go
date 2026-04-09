package env

import (
	"path/filepath"

	"github.com/joho/godotenv"
)

// Load reads .env files if present. Variables already set in the process environment
// are not overwritten. backend/.env is tried before cwd .env so repo-root .env (Vite)
// does not mask DATABASE_URL/JWT from backend/.env.
func Load() {
	paths := []string{
		filepath.Join("backend", ".env"),
		".env",
		filepath.Join("..", ".env"),
		filepath.Join("..", "..", ".env"),
	}
	for _, p := range paths {
		_ = godotenv.Load(p)
	}
}
