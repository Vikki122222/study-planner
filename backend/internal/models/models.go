package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email           string             `bson:"email" json:"email"`
	PasswordHash    string             `bson:"passwordHash" json:"-"`
	Name            string             `bson:"name" json:"name"`
	About           string             `bson:"about" json:"about"`
	LegacyAvatarURL string             `bson:"avatarUrl,omitempty" json:"-"`
	Avatar          string             `bson:"avatar" json:"avatar"`
	Sessions        []SessionNode      `bson:"sessions" json:"-"`
	Subjects        []SubjectNode      `bson:"subjects" json:"subjects"`
	Events          []EventNode        `bson:"events" json:"events"`
	CreatedAt       time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt       time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type SessionNode struct {
	ID         string    `bson:"id" json:"id"`
	UserAgent  string    `bson:"userAgent" json:"userAgent"`
	IP         string    `bson:"ip" json:"ip"`
	CreatedAt  time.Time `bson:"createdAt" json:"createdAt"`
	LastSeenAt time.Time `bson:"lastSeenAt" json:"lastSeenAt"`
	ExpiresAt  time.Time `bson:"expiresAt" json:"expiresAt"`
}

type SubjectNode struct {
	ID          string          `bson:"id" json:"id"`
	Title       string          `bson:"title" json:"title"`
	Description string          `bson:"description" json:"description"`
	ColorKey    string          `bson:"colorKey" json:"colorKey"`
	Notes       []NoteNode      `bson:"notes" json:"notes"`
	Flashcards  []FlashcardNode `bson:"flashcards" json:"flashcards"`
	Events      []EventNode     `bson:"events" json:"events"`
	CreatedAt   time.Time       `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time       `bson:"updatedAt" json:"updatedAt"`
}

type NoteNode struct {
	ID        string     `bson:"id" json:"id"`
	Title     string     `bson:"title" json:"title"`
	Content   string     `bson:"content" json:"content"`
	Date      string     `bson:"date" json:"date"`
	Files     []FileNode `bson:"files" json:"files"`
	CreatedAt time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time  `bson:"updatedAt" json:"updatedAt"`
}

type FileNode struct {
	ID           string    `bson:"id" json:"id"`
	FileName     string    `bson:"fileName" json:"fileName"`
	OriginalName string    `bson:"originalName" json:"originalName"`
	MimeType     string    `bson:"mimeType" json:"mimeType"`
	Size         int64     `bson:"size" json:"size"`
	URL          string    `bson:"url" json:"url"`
	IsImage      bool      `bson:"isImage" json:"isImage"`
	UploadedAt   time.Time `bson:"uploadedAt" json:"uploadedAt"`
}

type FlashcardNode struct {
	ID             string     `bson:"id" json:"id"`
	Question       string     `bson:"question" json:"question"`
	Answer         string     `bson:"answer" json:"answer"`
	Date           string     `bson:"date" json:"date"`
	LastReviewedAt *time.Time `bson:"lastReviewedAt,omitempty" json:"lastReviewedAt,omitempty"`
	ReviewCount    int        `bson:"reviewCount" json:"reviewCount"`
	CreatedAt      time.Time  `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time  `bson:"updatedAt" json:"updatedAt"`
}

type EventNode struct {
	ID          string    `bson:"id" json:"id"`
	Title       string    `bson:"title" json:"title"`
	Description string    `bson:"description" json:"description"`
	Date        string    `bson:"date" json:"date"`
	Time        string    `bson:"time" json:"time"`
	Importance  string    `bson:"importance" json:"importance"`
	CreatedAt   time.Time `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time `bson:"updatedAt" json:"updatedAt"`
}

type Subject struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	ColorKey    string             `bson:"colorKey" json:"colorKey"`
	Color       string             `bson:"color,omitempty" json:"color,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type Note struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"userId" json:"userId"`
	SubjectID primitive.ObjectID `bson:"subjectId" json:"subjectId"`
	Title     string             `bson:"title" json:"title"`
	Content   string             `bson:"content" json:"content"`
	Text      string             `bson:"text,omitempty" json:"text,omitempty"`
	Date      string             `bson:"date" json:"date"`
	Files     []NoteFile         `bson:"files" json:"files"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type NoteFile struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	FileID       primitive.ObjectID `bson:"fileId,omitempty" json:"fileId"`
	FileName     string             `bson:"fileName" json:"fileName"`
	OriginalName string             `bson:"originalName" json:"originalName"`
	MimeType     string             `bson:"mimeType" json:"mimeType"`
	Size         int64              `bson:"size" json:"size"`
	URL          string             `bson:"url" json:"url"`
	IsImage      bool               `bson:"isImage" json:"isImage"`
	UploadedAt   time.Time          `bson:"uploadedAt" json:"uploadedAt"`
}

type Flashcard struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID         primitive.ObjectID `bson:"userId" json:"userId"`
	SubjectID      primitive.ObjectID `bson:"subjectId" json:"subjectId"`
	Question       string             `bson:"question" json:"question"`
	Answer         string             `bson:"answer" json:"answer"`
	Date           string             `bson:"date" json:"date"`
	LastReviewedAt *time.Time         `bson:"lastReviewedAt,omitempty" json:"lastReviewedAt,omitempty"`
	ReviewCount    int                `bson:"reviewCount" json:"reviewCount"`
	CreatedAt      time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type Event struct {
	ID          primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID  `bson:"userId" json:"userId"`
	SubjectID   *primitive.ObjectID `bson:"subjectId,omitempty" json:"subjectId,omitempty"`
	Title       string              `bson:"title" json:"title"`
	Description string              `bson:"description" json:"description"`
	Date        string              `bson:"date" json:"date"`
	Time        string              `bson:"time" json:"time"`
	Importance  string              `bson:"importance" json:"importance"`
	Priority    string              `bson:"priority,omitempty" json:"priority,omitempty"`
	CreatedAt   time.Time           `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time           `bson:"updatedAt" json:"updatedAt"`
}

type Stats struct {
	Subjects   int64 `json:"subjects"`
	Notes      int64 `json:"notes"`
	Flashcards int64 `json:"flashcards"`
	Events     int64 `json:"events"`
}

type Recommendation struct {
	Type             string              `json:"type"`
	Title            string              `json:"title"`
	Text             string              `json:"text"`
	Priority         string              `json:"priority"`
	RelatedSubjectID *primitive.ObjectID `json:"relatedSubjectId,omitempty"`
}
