package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"studyplanner/backend/pkg/utils"
)

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		token := strings.TrimPrefix(header, "Bearer ")
		if token == "" || token == header {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Нужно войти в аккаунт."})
			return
		}

		userID, sessionID, err := utils.ParseToken(token, secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Сессия завершена. Войдите снова."})
			return
		}

		c.Set("userId", userID)
		c.Set("sessionId", sessionID)
		c.Next()
	}
}
