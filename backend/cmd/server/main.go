package main

import (
	"context"
	"log"
	"time"

	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/config"
	"neoflex-lms/internal/handlers"
	"neoflex-lms/internal/judge0"
	"neoflex-lms/internal/store"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required: backend now runs with PostgreSQL store")
	}

	pg, err := store.NewPostgres(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer pg.Close()
	log.Println("connected to PostgreSQL")

	authH := &handlers.Auth{Store: pg, JWTSecret: cfg.JWTSecret, TokenTTL: cfg.TokenTTL}
	userH := &handlers.User{Store: pg}
	courseH := &handlers.Course{Store: pg}
	j0 := &judge0.Client{
		BaseURL:       cfg.Judge0BaseURL,
		AuthToken:     cfg.Judge0AuthToken,
		RapidAPIKey:   cfg.Judge0RapidAPIKey,
		RapidAPIHost:  cfg.Judge0RapidAPIHost,
	}
	if cfg.Judge0AuthToken == "" && cfg.Judge0RapidAPIKey == "" {
		log.Println("Judge0: set JUDGE0_AUTH_TOKEN or JUDGE0_RAPIDAPI_KEY if submissions fail (CE often requires auth)")
	}
	taskH := &handlers.TaskCheck{Store: pg, Runner: j0}
	gitWh := &handlers.GitWebhook{Store: pg, Secret: cfg.WebhookGitSecret}
	adminH := &handlers.Admin{Store: pg, DefaultCourseID: cfg.StatsCourseID}
	if cfg.WebhookGitSecret == "" {
		log.Println("WEBHOOK_GIT_SECRET is empty — Git webhook accepts unsigned requests (set for production)")
	}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.POST("/webhooks/git", gitWh.HandleGitLab)

	api := r.Group("/api")
	api.POST("/auth/login", authH.Login)
	api.GET("/courses", courseH.ListPublished)
	api.GET("/courses/:id/lessons", courseH.LessonsForCourse)

	protected := api.Group("")
	protected.Use(auth.Middleware(cfg.JWTSecret))
	protected.GET("/users/me/profile", userH.MeProfile)
	protected.POST("/tasks/:task_id/check", taskH.Check)

	mod := protected.Group("")
	mod.Use(auth.RequireRole("moderator"))
	mod.POST("/courses/create", courseH.Create)
	mod.GET("/admin/users/stats", adminH.UserStats)

	addr := ":" + cfg.Port
	log.Printf("listening on %s (CORS origin: %s)", addr, cfg.FrontendOrigin)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
