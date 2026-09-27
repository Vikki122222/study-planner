package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort          string
	AppEnv           string
	MongoURI         string
	MongoDBName      string
	JWTSecret        string
	JWTExpiresIn     time.Duration
	FrontendURL      string
	UploadDir        string
	MaxUploadSizeMB  int64
	AllowedFileTypes []string
}

func Load() Config {
	if err := godotenv.Load(); err != nil {
		log.Println(".env file was not loaded, using environment variables")
	}
	expires, err := time.ParseDuration(getEnv("JWT_EXPIRES_IN", "336h"))
	if err != nil {
		expires = 14 * 24 * time.Hour
	}
	maxUploadSize, err := strconv.ParseInt(getEnv("MAX_UPLOAD_SIZE_MB", "10"), 10, 64)
	if err != nil || maxUploadSize <= 0 {
		maxUploadSize = 10
	}
	return Config{
		AppPort:          requiredEnv("APP_PORT"),
		AppEnv:           requiredEnv("APP_ENV"),
		MongoURI:         requiredEnv("MONGO_URI"),
		MongoDBName:      requiredEnv("MONGO_DB_NAME"),
		JWTSecret:        requiredEnv("JWT_SECRET"),
		JWTExpiresIn:     expires,
		FrontendURL:      requiredEnv("FRONTEND_URL"),
		UploadDir:        requiredEnv("UPLOAD_DIR"),
		MaxUploadSizeMB:  maxUploadSize,
		AllowedFileTypes: splitCSV(getEnv("ALLOWED_FILE_TYPES", "image/jpeg,image/png,image/webp,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func requiredEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("required environment variable %s is not set", key)
	}
	return value
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
