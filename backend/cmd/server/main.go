package main

import (
	"log"
	"time"

	"neoflex-lms/internal/auth"
	"neoflex-lms/internal/config"
	"neoflex-lms/internal/handlers"
	"neoflex-lms/internal/store"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL != "" {
		log.Println("DATABASE_URL is set; PostgreSQL store is not wired yet — using in-memory store")
	}

	mem, err := store.NewMemory()
	if err != nil {
		log.Fatal(err)
	}

	authH := &handlers.Auth{Store: mem, JWTSecret: cfg.JWTSecret, TokenTTL: cfg.TokenTTL}
	userH := &handlers.User{Store: mem}

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

	api := r.Group("/api")
	api.POST("/auth/login", authH.Login)

	protected := api.Group("")
	protected.Use(auth.Middleware(cfg.JWTSecret))
	protected.GET("/users/me/profile", userH.MeProfile)

	addr := ":" + cfg.Port
	log.Printf("listening on %s (CORS origin: %s)", addr, cfg.FrontendOrigin)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
