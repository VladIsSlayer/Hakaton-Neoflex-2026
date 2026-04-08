package config

import (
	"os"
	"time"
)

type Config struct {
	Port              string
	JWTSecret         []byte
	TokenTTL          time.Duration
	FrontendOrigin    string
	DatabaseURL       string
	SeedJSONPath      string
	Judge0BaseURL     string
	Judge0AuthToken   string
	Judge0RapidAPIKey string
	Judge0RapidAPIHost string
	WebhookGitSecret   string
	StatsCourseID      string
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
	seedPath := os.Getenv("SEED_JSON_PATH")
	if seedPath == "" {
		seedPath = "data/seed.json"
	}
	j0base := os.Getenv("JUDGE0_BASE_URL")
	if j0base == "" {
		j0base = "https://ce.judge0.com"
	}
	j0token := os.Getenv("JUDGE0_AUTH_TOKEN")
	if j0token == "" {
		j0token = os.Getenv("JUDGE0_TOKEN")
	}
	statsCourse := os.Getenv("STATS_COURSE_ID")
	if statsCourse == "" {
		statsCourse = "b0000000-0000-4000-8000-000000000001"
	}
	return Config{
		Port:               port,
		JWTSecret:          []byte(secret),
		TokenTTL:           24 * time.Hour,
		FrontendOrigin:     origin,
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		SeedJSONPath:       seedPath,
		Judge0BaseURL:      j0base,
		Judge0AuthToken:    j0token,
		Judge0RapidAPIKey:  os.Getenv("JUDGE0_RAPIDAPI_KEY"),
		Judge0RapidAPIHost: os.Getenv("JUDGE0_RAPIDAPI_HOST"),
		WebhookGitSecret:   os.Getenv("WEBHOOK_GIT_SECRET"),
		StatsCourseID:      statsCourse,
	}
}
