package config

import (
	"os"
	"time"
)

type Config struct {
	Port           string
	JWTSecret      []byte
	TokenTTL       time.Duration
	FrontendOrigin string
	DatabaseURL    string
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-only-insecure-secret-min-32-chars!!"
	}
	origin := os.Getenv("FRONTEND_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	return Config{
		Port:           port,
		JWTSecret:      []byte(secret),
		TokenTTL:       24 * time.Hour,
		FrontendOrigin: origin,
		DatabaseURL:    os.Getenv("DATABASE_URL"),
	}
}
