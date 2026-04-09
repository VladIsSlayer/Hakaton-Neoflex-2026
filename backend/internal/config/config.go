package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port               string
	AppEnv             string
	JWTSecret          []byte
	TokenTTL           time.Duration
	FrontendOrigin     string
	DatabaseURL        string
	SeedJSONPath       string
	Judge0BaseURL      string
	Judge0AuthToken    string
	Judge0RapidAPIKey  string
	Judge0RapidAPIHost string
	WebhookGitSecret   string
	StatsCourseID      string
	DBMaxConns         int32
	DBMinConns         int32
	DBMaxConnLifetime  time.Duration
	DBMaxConnIdleTime  time.Duration
	DBHealthCheckEvery time.Duration
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	secret := os.Getenv("JWT_SECRET")
	origin := os.Getenv("FRONTEND_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
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
		AppEnv:             appEnv,
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
		DBMaxConns:         int32(readInt("DB_MAX_CONNS", 20)),
		DBMinConns:         int32(readInt("DB_MIN_CONNS", 2)),
		DBMaxConnLifetime:  readDuration("DB_MAX_CONN_LIFETIME", 30*time.Minute),
		DBMaxConnIdleTime:  readDuration("DB_MAX_CONN_IDLE_TIME", 5*time.Minute),
		DBHealthCheckEvery: readDuration("DB_HEALTH_CHECK_PERIOD", 1*time.Minute),
	}
}

func readInt(name string, fallback int) int {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func readDuration(name string, fallback time.Duration) time.Duration {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	v, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return v
}
