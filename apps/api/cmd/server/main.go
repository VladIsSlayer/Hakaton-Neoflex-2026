package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/config"
	"neoflex-lms/internal/env"
	"neoflex-lms/internal/handlers"
	"neoflex-lms/internal/judge0"
	"neoflex-lms/internal/store"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	env.Load()
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required: backend now runs with PostgreSQL store")
	}
	if len(cfg.JWTSecret) == 0 {
		log.Fatal("JWT_SECRET is required")
	}
	if cfg.AppEnv == "production" && cfg.WebhookGitSecret == "" {
		log.Fatal("WEBHOOK_GIT_SECRET is required in production")
	}

	pg, err := store.NewPostgres(context.Background(), cfg.DatabaseURL, store.PostgresOptions{
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
	log.Println("connected to PostgreSQL")

	seedPath := resolveSeedFilePath(cfg.SeedJSONPath)
	if cfg.SeedIfEmpty {
		ctxSeed, cancelSeed := context.WithTimeout(context.Background(), 60*time.Second)
		nPub, errCount := pg.PublishedCourseCount(ctxSeed)
		cancelSeed()
		if errCount != nil {
			log.Printf("published course count: %v (auto-seed skipped)", errCount)
		} else if nPub == 0 {
			ctxSeed, cancelSeed := context.WithTimeout(context.Background(), 60*time.Second)
			log.Printf("SEED_IF_EMPTY: loading catalog from %s", seedPath)
			err := pg.SeedFromJSON(ctxSeed, seedPath)
			cancelSeed()
			if err != nil {
				log.Fatalf("seed postgres: %v", err)
			}
			log.Println("PostgreSQL catalog seeded from JSON (demo course + lessons + tasks)")
		}
	}

	authH := &handlers.Auth{Store: pg, JWTSecret: cfg.JWTSecret, TokenTTL: cfg.TokenTTL}
	userH := &handlers.User{Store: pg, Snapshot: pg}
	courseH := &handlers.Course{Store: pg}
	statsH := &handlers.Stats{Store: pg}
	lessonTaskH := &handlers.LessonTask{Tasks: pg}
	j0 := &judge0.Client{
		BaseURL:      cfg.Judge0BaseURL,
		AuthToken:    cfg.Judge0AuthToken,
		RapidAPIKey:  cfg.Judge0RapidAPIKey,
		RapidAPIHost: cfg.Judge0RapidAPIHost,
	}
	if cfg.Judge0AuthToken == "" && cfg.Judge0RapidAPIKey == "" {
		log.Println("Judge0: set JUDGE0_AUTH_TOKEN or JUDGE0_RAPIDAPI_KEY if submissions fail (CE often requires auth)")
	}
	taskH := &handlers.TaskCheck{Store: pg, Runner: j0}
	enrollH := &handlers.Enrollment{Writer: pg}
	gitWh := &handlers.GitWebhook{Store: pg, Secret: cfg.WebhookGitSecret}
	adminH := &handlers.Admin{Store: pg, DefaultCourseID: cfg.StatsCourseID}
	if cfg.WebhookGitSecret == "" {
		log.Println("WEBHOOK_GIT_SECRET is empty — Git webhook accepts unsigned requests (set for production)")
	}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.FrontendOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/api/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := pg.Ping(ctx); err != nil {
			c.JSON(503, gin.H{"status": "degraded", "db": "down"})
			return
		}
		c.JSON(200, gin.H{"status": "ok", "db": "up"})
	})

	r.POST("/webhooks/git", gitWh.HandleGitLab)

	api := r.Group("/api")
	api.POST("/auth/login", authH.Login)
	api.POST("/auth/register", authH.Register)
	api.GET("/courses", courseH.ListPublished)
	api.GET("/lessons", courseH.ListCatalogLessons)
	api.GET("/lessons/:lesson_id/task", lessonTaskH.TaskMeta)
	api.GET("/courses/:id/lessons", courseH.LessonsForCourse)
	api.GET("/stats/course-enrollments", statsH.CourseEnrollments)

	protected := api.Group("")
	protected.Use(auth.Middleware(cfg.JWTSecret))
	protected.GET("/users/me/profile", userH.MeProfile)
	protected.GET("/users/me/snapshot", userH.MeSnapshot)
	protected.POST("/tasks/:task_id/check", taskH.Check)

	student := protected.Group("")
	student.Use(auth.RequireRole("student"))
	student.POST("/enrollments", enrollH.Enroll)

	mod := protected.Group("")
	mod.Use(auth.RequireRole("moderator"))
	mod.POST("/courses/create", courseH.Create)
	mod.POST("/courses/:id/lessons", courseH.CreateLesson)
	mod.POST("/lessons/:lesson_id/tasks", lessonTaskH.CreateTask)
	mod.GET("/admin/users/stats", adminH.UserStats)

	addr := ":" + cfg.Port
	log.Printf("listening on %s (CORS origins: %s)", addr, strings.Join(cfg.FrontendOrigins, ", "))
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}

func resolveSeedFilePath(primary string) string {
	if fi, err := os.Stat(primary); err == nil && !fi.IsDir() {
		return primary
	}
	alt := filepath.Join("apps", "api", primary)
	if fi, err := os.Stat(alt); err == nil && !fi.IsDir() {
		return alt
	}
	return primary
}
