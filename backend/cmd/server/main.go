package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"studyplanner/backend/internal/config"
	"studyplanner/backend/internal/handlers"
	"studyplanner/backend/internal/middleware"
	"studyplanner/backend/internal/models"
	"studyplanner/backend/pkg/database"
)

func main() {
	cfg := config.Load()

	client, err := database.Connect(cfg.MongoURI)
	if err != nil {
		log.Fatalf("mongo connection failed: %v", err)
	}
	db := client.Database(cfg.MongoDBName)
	if err := ensureIndexes(db); err != nil {
		log.Fatalf("index creation failed: %v", err)
	}
	if err := migrateUsers(db); err != nil {
		log.Fatalf("user migration failed: %v", err)
	}

	if err := os.MkdirAll(cfg.UploadDir, 0755); err != nil {
		log.Fatalf("upload directory creation failed: %v", err)
	}

	app := handlers.New(db, cfg.JWTSecret, cfg.JWTExpiresIn, cfg.UploadDir, cfg.MaxUploadSizeMB*1024*1024, cfg.AllowedFileTypes)
	router := gin.Default()
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	router.Static("/uploads", cfg.UploadDir)

	api := router.Group("/api")
	api.POST("/auth/register", app.Register)
	api.POST("/auth/login", app.Login)

	protected := api.Group("/")
	protected.Use(middleware.Auth(cfg.JWTSecret))
	protected.GET("/auth/me", app.GetProfile)
	protected.GET("/dashboard", app.ListDashboard)
	protected.GET("/calendar/month", app.CalendarMonth)
	protected.GET("/day", app.Day)
	protected.GET("/stats", app.Stats)
	protected.GET("/profile", app.GetProfile)
	protected.PUT("/profile", app.UpdateProfile)
	protected.POST("/profile/avatar", app.UploadAvatar)
	protected.PUT("/profile/password", app.ChangePassword)
	protected.GET("/sessions", app.ListSessions)
	protected.DELETE("/sessions/:sessionId", app.DeleteSession)

	protected.GET("/subjects", app.ListSubjects)
	protected.POST("/subjects", app.CreateSubject)
	protected.PUT("/subjects/:subjectId", app.UpdateSubject)
	protected.DELETE("/subjects/:subjectId", app.DeleteSubject)

	protected.GET("/subjects/:subjectId/notes", app.ListNotes)
	protected.POST("/subjects/:subjectId/notes", app.CreateNote)
	protected.PUT("/subjects/:subjectId/notes/:noteId", app.UpdateNote)
	protected.DELETE("/subjects/:subjectId/notes/:noteId", app.DeleteNote)
	protected.POST("/subjects/:subjectId/notes/:noteId/files", app.UploadNoteFile)
	protected.DELETE("/subjects/:subjectId/notes/:noteId/files/:fileId", app.DeleteNoteFile)

	protected.GET("/subjects/:subjectId/flashcards", app.ListFlashcards)
	protected.POST("/subjects/:subjectId/flashcards", app.CreateFlashcard)
	protected.PUT("/subjects/:subjectId/flashcards/:cardId", app.UpdateFlashcard)
	protected.DELETE("/subjects/:subjectId/flashcards/:cardId", app.DeleteFlashcard)
	protected.POST("/subjects/:subjectId/flashcards/:cardId/review", app.ReviewFlashcard)

	protected.GET("/subjects/:subjectId/events", app.ListEvents)
	protected.POST("/subjects/:subjectId/events", app.CreateEvent)
	protected.PUT("/subjects/:subjectId/events/:eventId", app.UpdateEvent)
	protected.DELETE("/subjects/:subjectId/events/:eventId", app.DeleteEvent)

	protected.GET("/notes", app.ListNotes)
	protected.GET("/notes/recent", app.RecentNotes)
	protected.POST("/notes", app.CreateNote)
	protected.PUT("/notes/:id", app.UpdateNote)
	protected.DELETE("/notes/:id", app.DeleteNote)
	protected.POST("/notes/:id/files", app.UploadNoteFile)
	protected.DELETE("/notes/:id/files/:fileId", app.DeleteNoteFile)

	protected.GET("/flashcards", app.ListFlashcards)
	protected.GET("/flashcards/recent", app.RecentFlashcards)
	protected.POST("/flashcards", app.CreateFlashcard)
	protected.POST("/flashcards/:id/review", app.ReviewFlashcard)
	protected.PUT("/flashcards/:id", app.UpdateFlashcard)
	protected.DELETE("/flashcards/:id", app.DeleteFlashcard)

	protected.GET("/events", app.ListEvents)
	protected.GET("/events/upcoming", app.UpcomingEvents)
	protected.GET("/events/feed", app.EventFeed)
	protected.POST("/events", app.CreateEvent)
	protected.PUT("/events/:id", app.UpdateEvent)
	protected.DELETE("/events/:id", app.DeleteEvent)
	protected.GET("/recommendations", app.Recommendations)

	log.Printf("server is running on :%s", cfg.AppPort)
	if err := router.Run(":" + cfg.AppPort); err != nil {
		log.Fatal(err)
	}
}

func ensureIndexes(db *mongo.Database) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := db.Collection("users").Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	return err
}

func migrateUsers(db *mongo.Database) error {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	users := db.Collection("users")
	cursor, err := users.Find(ctx, bson.M{"avatarUrl": bson.M{"$exists": true}})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	for cursor.Next(ctx) {
		var user models.User
		if err := cursor.Decode(&user); err != nil {
			return err
		}
		if user.Avatar == "" && user.LegacyAvatarURL != "" {
			user.Avatar = user.LegacyAvatarURL
		}
		user.LegacyAvatarURL = ""
		if _, err := users.ReplaceOne(ctx, bson.M{"_id": user.ID}, user); err != nil {
			return err
		}
	}
	return cursor.Err()
}
