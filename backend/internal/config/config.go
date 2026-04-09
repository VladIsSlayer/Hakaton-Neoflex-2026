package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port               string
	AppEnv             string
	JWTSecret          []byte
	TokenTTL           time.Duration
	FrontendOrigins    []string
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
	appEnv := os.Getenv("APP_ENV")
	if appEnv == "" {
		appEnv = "development"
	}
	frontendOrigins := parseFrontendCORSOrigins(appEnv)
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
		FrontendOrigins:    frontendOrigins,
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

// parseFrontendCORSOrigins — AllowOrigins для CORS.
// FRONTEND_ORIGINS (через запятую) имеет приоритет над FRONTEND_ORIGIN.
// В development к каждому http://localhost:PORT добавляется http://127.0.0.1:PORT и наоборот.
func parseFrontendCORSOrigins(appEnv string) []string {
	raw := strings.TrimSpace(os.Getenv("FRONTEND_ORIGINS"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
	}
	if raw == "" {
		raw = "http://localhost:5173"
	}
	parts := strings.Split(raw, ",")
	seen := make(map[string]bool)
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		out = append(out, p)
	}
	if len(out) == 0 {
		out = []string{"http://localhost:5173"}
	}
	if appEnv == "development" {
		out = mirrorLocalhostLoopbackOrigins(out, seen)
	}
	return out
}

func mirrorLocalhostLoopbackOrigins(origins []string, seen map[string]bool) []string {
	out := append([]string(nil), origins...)
	for _, o := range origins {
		if alt := httpLocalhostTo127(o); alt != "" && !seen[alt] {
			seen[alt] = true
			out = append(out, alt)
		}
		if alt := http127ToLocalhost(o); alt != "" && !seen[alt] {
			seen[alt] = true
			out = append(out, alt)
		}
	}
	return out
}

func httpLocalhostTo127(o string) string {
	const p = "http://localhost:"
	if strings.HasPrefix(o, p) {
		return "http://127.0.0.1:" + strings.TrimPrefix(o, p)
	}
	return ""
}

func http127ToLocalhost(o string) string {
	const p = "http://127.0.0.1:"
	if strings.HasPrefix(o, p) {
		return "http://localhost:" + strings.TrimPrefix(o, p)
	}
	return ""
}
