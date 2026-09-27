package utils

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func CreateToken(userID primitive.ObjectID, sessionID string, secret string, expiresIn time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"userId":    userID.Hex(),
		"sessionId": sessionID,
		"exp":       time.Now().Add(expiresIn).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenString, secret string) (primitive.ObjectID, string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return primitive.NilObjectID, "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return primitive.NilObjectID, "", jwt.ErrTokenInvalidClaims
	}
	rawID, ok := claims["userId"].(string)
	if !ok {
		return primitive.NilObjectID, "", jwt.ErrTokenInvalidClaims
	}
	sessionID, ok := claims["sessionId"].(string)
	if !ok || sessionID == "" {
		return primitive.NilObjectID, "", jwt.ErrTokenInvalidClaims
	}
	userID, err := primitive.ObjectIDFromHex(rawID)
	return userID, sessionID, err
}
