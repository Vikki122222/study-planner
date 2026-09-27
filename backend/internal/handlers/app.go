package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
	"studyplanner/backend/internal/models"
	"studyplanner/backend/pkg/utils"
)

var subjectPalette = []string{"blue", "green", "violet", "orange", "teal", "rose", "gray", "olive"}

type App struct {
	DB            *mongo.Database
	JWTSecret     string
	JWTExpiresIn  time.Duration
	UploadDir     string
	MaxUploadSize int64
	AllowedTypes  map[string]bool
}

func New(db *mongo.Database, jwtSecret string, jwtExpiresIn time.Duration, uploadDir string, maxUploadSize int64, allowedTypes []string) *App {
	allowed := make(map[string]bool, len(allowedTypes))
	for _, mimeType := range allowedTypes {
		allowed[mimeType] = true
	}
	return &App{DB: db, JWTSecret: jwtSecret, JWTExpiresIn: jwtExpiresIn, UploadDir: uploadDir, MaxUploadSize: maxUploadSize, AllowedTypes: allowed}
}

func (a *App) Register(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
		Name     string `json:"name" binding:"required"`
	}
	if !bind(c, &input) {
		return
	}
	users := a.DB.Collection("users")
	count, err := users.CountDocuments(c, bson.M{"email": input.Email})
	if err != nil {
		serverError(c, err)
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		serverError(c, err)
		return
	}
	now := time.Now()
	session := a.newSession(c, now)
	user := models.User{
		ID: primitive.NewObjectID(), Email: input.Email, PasswordHash: string(hash), Name: input.Name,
		Sessions: []models.SessionNode{session}, Subjects: []models.SubjectNode{}, Events: []models.EventNode{}, CreatedAt: now, UpdatedAt: now,
	}
	if _, err := users.InsertOne(c, user); err != nil {
		serverError(c, err)
		return
	}
	token, err := utils.CreateToken(user.ID, session.ID, a.JWTSecret, a.JWTExpiresIn)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"token": token, "user": user})
}

func (a *App) Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if !bind(c, &input) {
		return
	}
	user, err := a.findUserByEmail(c, input.Email)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	now := time.Now()
	session := a.newSession(c, now)
	user.Sessions = append(validSessions(user.Sessions, now), session)
	user.UpdatedAt = now
	if !a.saveUser(c, &user) {
		return
	}
	token, err := utils.CreateToken(user.ID, session.ID, a.JWTSecret, a.JWTExpiresIn)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": user})
}

func (a *App) GetProfile(c *gin.Context) {
	user, ok := a.currentUser(c)
	if ok {
		c.JSON(http.StatusOK, user)
	}
}

func (a *App) UpdateProfile(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	var input struct {
		Name   string `json:"name"`
		About  string `json:"about"`
		Avatar string `json:"avatar"`
	}
	if !bind(c, &input) {
		return
	}
	if input.Name != "" {
		user.Name = input.Name
	}
	user.About = input.About
	if input.Avatar != "" {
		user.Avatar = input.Avatar
	}
	user.LegacyAvatarURL = ""
	user.UpdatedAt = time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, user)
}

func (a *App) UploadAvatar(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, a.MaxUploadSize)
	file, err := c.FormFile("avatar")
	if err != nil || file.Size > a.MaxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid avatar file"})
		return
	}
	opened, err := file.Open()
	if err != nil {
		serverError(c, err)
		return
	}
	defer opened.Close()
	buffer := make([]byte, 512)
	n, _ := opened.Read(buffer)
	mimeType := http.DetectContentType(buffer[:n])
	if !isImageFile(mimeType, file.Filename) || !a.allowedMimeType(mimeType, file.Filename) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "avatar must be an allowed image"})
		return
	}
	_ = os.MkdirAll(a.UploadDir, 0755)
	generated := "avatar_" + user.ID.Hex() + "_" + primitive.NewObjectID().Hex() + strings.ToLower(filepath.Ext(file.Filename))
	if err := c.SaveUploadedFile(file, filepath.Join(a.UploadDir, generated)); err != nil {
		serverError(c, err)
		return
	}
	if user.Avatar != "" && strings.HasPrefix(user.Avatar, "/uploads/avatar_") {
		_ = os.Remove(filepath.Join(a.UploadDir, filepath.Base(user.Avatar)))
	}
	user.Avatar = "/uploads/" + generated
	user.LegacyAvatarURL = ""
	user.UpdatedAt = time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, user)
}

func (a *App) ChangePassword(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	var input struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=6"`
	}
	if !bind(c, &input) {
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.CurrentPassword)) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Старый пароль указан неверно."})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		serverError(c, err)
		return
	}
	user.PasswordHash = string(hash)
	user.Sessions = []models.SessionNode{}
	user.UpdatedAt = time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Пароль изменен. Все сессии завершены."})
}

func (a *App) ListSessions(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	currentID := mustSessionID(c)
	now := time.Now()
	active := validSessions(user.Sessions, now)
	sort.Slice(active, func(i, j int) bool {
		if active[i].ID == currentID {
			return true
		}
		if active[j].ID == currentID {
			return false
		}
		return active[i].LastSeenAt.After(active[j].LastSeenAt)
	})
	sessions := []gin.H{}
	for _, session := range active {
		sessions = append(sessions, gin.H{
			"id":         session.ID,
			"userAgent":  session.UserAgent,
			"ip":         session.IP,
			"createdAt":  session.CreatedAt,
			"lastSeenAt": session.LastSeenAt,
			"expiresAt":  session.ExpiresAt,
			"current":    session.ID == currentID,
		})
	}
	c.JSON(http.StatusOK, sessions)
}

func (a *App) DeleteSession(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	sessionID := c.Param("sessionId")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session id is required"})
		return
	}
	if sessionID == "current" {
		sessionID = mustSessionID(c)
	}
	next := make([]models.SessionNode, 0, len(user.Sessions))
	found := false
	for _, session := range user.Sessions {
		if session.ID == sessionID {
			found = true
			continue
		}
		next = append(next, session)
	}
	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}
	user.Sessions = next
	if !a.saveUser(c, &user) {
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *App) ListDashboard(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	notes, cards, events := a.flatten(&user)
	upcoming := filterUpcoming(events, 8)
	c.JSON(http.StatusOK, gin.H{
		"stats":            a.stats(&user),
		"subjects":         user.Subjects,
		"notes":            notes,
		"flashcards":       cards,
		"events":           events,
		"upcomingEvents":   upcoming,
		"eventFeed":        filterUpcoming(events, 20),
		"recentNotes":      latest(notes, "createdAt", 6),
		"recentFlashcards": latest(cards, "createdAt", 6),
		"recommendations":  a.buildRecommendations(&user),
	})
}

func (a *App) Stats(c *gin.Context) {
	user, ok := a.currentUser(c)
	if ok {
		c.JSON(http.StatusOK, a.stats(&user))
	}
}

func (a *App) CalendarMonth(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	year, _ := strconv.Atoi(c.Query("year"))
	month, _ := strconv.Atoi(c.Query("month"))
	if year == 0 || month < 1 || month > 12 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid year and month are required"})
		return
	}
	first := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	notes, cards, events := a.flatten(&user)
	days := []gin.H{}
	for day := first; day.Month() == first.Month(); day = day.AddDate(0, 0, 1) {
		iso := day.Format("2006-01-02")
		ec, nc, cc, high := 0, 0, 0, false
		for _, event := range events {
			if event["date"] == iso {
				ec++
				high = high || event["importance"] == "high"
			}
		}
		for _, note := range notes {
			if note["date"] == iso {
				nc++
			}
		}
		for _, card := range cards {
			if card["date"] == iso {
				cc++
			}
		}
		days = append(days, gin.H{"date": iso, "eventsCount": ec, "notesCount": nc, "flashcardsCount": cc, "hasHighPriorityEvent": high})
	}
	c.JSON(http.StatusOK, gin.H{"year": year, "month": month, "days": days})
}

func (a *App) Day(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	date := c.Query("date")
	notes, cards, events := a.flatten(&user)
	files := []gin.H{}
	dayNotes, dayCards, dayEvents := []gin.H{}, []gin.H{}, []gin.H{}
	for _, note := range notes {
		if note["date"] == date {
			dayNotes = append(dayNotes, note)
			for _, file := range note["files"].([]models.FileNode) {
				files = append(files, gin.H{"id": file.ID, "noteId": note["id"], "noteTitle": note["title"], "fileName": file.FileName, "originalName": file.OriginalName, "mimeType": file.MimeType, "size": file.Size, "url": file.URL, "isImage": file.IsImage, "uploadedAt": file.UploadedAt})
			}
		}
	}
	for _, card := range cards {
		if card["date"] == date {
			dayCards = append(dayCards, card)
		}
	}
	for _, event := range events {
		if event["date"] == date {
			dayEvents = append(dayEvents, event)
		}
	}
	c.JSON(http.StatusOK, gin.H{"date": date, "events": dayEvents, "notes": dayNotes, "flashcards": dayCards, "files": files})
}

func (a *App) ListSubjects(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	search := strings.ToLower(strings.TrimSpace(c.Query("search")))
	subjects := []models.SubjectNode{}
	for _, subject := range user.Subjects {
		if search == "" || strings.Contains(strings.ToLower(subject.Title), search) {
			subjects = append(subjects, subject)
		}
	}
	c.JSON(http.StatusOK, subjects)
}

func (a *App) CreateSubject(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	var input struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
	}
	if !bind(c, &input) {
		return
	}
	now := time.Now()
	subject := models.SubjectNode{ID: newID("subject"), Title: input.Title, Description: input.Description, ColorKey: subjectPalette[len(user.Subjects)%len(subjectPalette)], Notes: []models.NoteNode{}, Flashcards: []models.FlashcardNode{}, Events: []models.EventNode{}, CreatedAt: now, UpdatedAt: now}
	user.Subjects = append(user.Subjects, subject)
	user.UpdatedAt = now
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusCreated, subject)
}

func (a *App) UpdateSubject(c *gin.Context) {
	user, si, ok := a.subjectFromRequest(c)
	if !ok {
		return
	}
	var input struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
	}
	if !bind(c, &input) {
		return
	}
	user.Subjects[si].Title = input.Title
	user.Subjects[si].Description = input.Description
	user.Subjects[si].UpdatedAt = time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, user.Subjects[si])
}

func (a *App) DeleteSubject(c *gin.Context) {
	user, si, ok := a.subjectFromRequest(c)
	if !ok {
		return
	}
	for _, note := range user.Subjects[si].Notes {
		a.removeNoteFiles(note)
	}
	user.Subjects = append(user.Subjects[:si], user.Subjects[si+1:]...)
	user.UpdatedAt = time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *App) ListNotes(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	subjectID := fallback(c.Param("subjectId"), c.Query("subjectId"))
	date := c.Query("date")
	notes := []gin.H{}
	for _, subject := range user.Subjects {
		if subjectID != "" && subject.ID != subjectID {
			continue
		}
		for _, note := range subject.Notes {
			if date == "" || note.Date == date {
				notes = append(notes, notePayload(subject, note))
			}
		}
	}
	c.JSON(http.StatusOK, notes)
}

func (a *App) CreateNote(c *gin.Context) {
	user, si, ok := a.subjectForNestedOrBody(c)
	if !ok {
		return
	}
	var input struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
		Text    string `json:"text"`
		Date    string `json:"date" binding:"required"`
	}
	if !bind(c, &input) {
		return
	}
	now := time.Now()
	note := models.NoteNode{ID: newID("note"), Title: input.Title, Content: fallback(input.Content, input.Text), Date: input.Date, Files: []models.FileNode{}, CreatedAt: now, UpdatedAt: now}
	user.Subjects[si].Notes = append(user.Subjects[si].Notes, note)
	user.Subjects[si].UpdatedAt = now
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusCreated, notePayload(user.Subjects[si], note))
}

func (a *App) UpdateNote(c *gin.Context) {
	user, si, ni, ok := a.noteFromRequest(c)
	if !ok {
		return
	}
	var input struct {
		Title   string `json:"title" binding:"required"`
		Content string `json:"content"`
		Text    string `json:"text"`
		Date    string `json:"date" binding:"required"`
	}
	if !bind(c, &input) {
		return
	}
	note := &user.Subjects[si].Notes[ni]
	note.Title, note.Content, note.Date, note.UpdatedAt = input.Title, fallback(input.Content, input.Text), input.Date, time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, notePayload(user.Subjects[si], *note))
}

func (a *App) DeleteNote(c *gin.Context) {
	user, si, ni, ok := a.noteFromRequest(c)
	if !ok {
		return
	}
	a.removeNoteFiles(user.Subjects[si].Notes[ni])
	user.Subjects[si].Notes = append(user.Subjects[si].Notes[:ni], user.Subjects[si].Notes[ni+1:]...)
	if !a.saveUser(c, &user) {
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *App) UploadNoteFile(c *gin.Context) {
	user, si, ni, ok := a.noteFromRequest(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, a.MaxUploadSize)
	file, err := c.FormFile("file")
	if err != nil || file.Size > a.MaxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file"})
		return
	}
	opened, err := file.Open()
	if err != nil {
		serverError(c, err)
		return
	}
	defer opened.Close()
	buffer := make([]byte, 512)
	n, _ := opened.Read(buffer)
	mimeType := http.DetectContentType(buffer[:n])
	if !a.allowedMimeType(mimeType, file.Filename) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
		return
	}
	_ = os.MkdirAll(a.UploadDir, 0755)
	generated := primitive.NewObjectID().Hex() + strings.ToLower(filepath.Ext(file.Filename))
	if err := c.SaveUploadedFile(file, filepath.Join(a.UploadDir, generated)); err != nil {
		serverError(c, err)
		return
	}
	meta := models.FileNode{ID: newID("file"), FileName: generated, OriginalName: file.Filename, MimeType: mimeType, Size: file.Size, URL: "/uploads/" + generated, IsImage: strings.HasPrefix(mimeType, "image/"), UploadedAt: time.Now()}
	user.Subjects[si].Notes[ni].Files = append(user.Subjects[si].Notes[ni].Files, meta)
	user.Subjects[si].Notes[ni].UpdatedAt = time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusCreated, notePayload(user.Subjects[si], user.Subjects[si].Notes[ni]))
}

func (a *App) DeleteNoteFile(c *gin.Context) {
	user, si, ni, ok := a.noteFromRequest(c)
	if !ok {
		return
	}
	fileID := c.Param("fileId")
	files := user.Subjects[si].Notes[ni].Files
	for i, file := range files {
		if file.ID == fileID {
			_ = os.Remove(filepath.Join(a.UploadDir, file.FileName))
			user.Subjects[si].Notes[ni].Files = append(files[:i], files[i+1:]...)
			if !a.saveUser(c, &user) {
				return
			}
			c.Status(http.StatusNoContent)
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
}

func (a *App) ListFlashcards(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	subjectID := fallback(c.Param("subjectId"), c.Query("subjectId"))
	date := c.Query("date")
	cards := []gin.H{}
	for _, subject := range user.Subjects {
		if subjectID != "" && subject.ID != subjectID {
			continue
		}
		for _, card := range subject.Flashcards {
			if date == "" || card.Date == date {
				cards = append(cards, cardPayload(subject, card))
			}
		}
	}
	c.JSON(http.StatusOK, cards)
}

func (a *App) CreateFlashcard(c *gin.Context) {
	user, si, ok := a.subjectForNestedOrBody(c)
	if !ok {
		return
	}
	var input struct {
		Question string `json:"question" binding:"required"`
		Answer   string `json:"answer" binding:"required"`
		Date     string `json:"date" binding:"required"`
	}
	if !bind(c, &input) {
		return
	}
	now := time.Now()
	card := models.FlashcardNode{ID: newID("card"), Question: input.Question, Answer: input.Answer, Date: input.Date, ReviewCount: 0, CreatedAt: now, UpdatedAt: now}
	user.Subjects[si].Flashcards = append(user.Subjects[si].Flashcards, card)
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusCreated, cardPayload(user.Subjects[si], card))
}

func (a *App) UpdateFlashcard(c *gin.Context) {
	user, si, ci, ok := a.cardFromRequest(c)
	if !ok {
		return
	}
	var input struct {
		Question string `json:"question" binding:"required"`
		Answer   string `json:"answer" binding:"required"`
		Date     string `json:"date" binding:"required"`
	}
	if !bind(c, &input) {
		return
	}
	card := &user.Subjects[si].Flashcards[ci]
	card.Question, card.Answer, card.Date, card.UpdatedAt = input.Question, input.Answer, input.Date, time.Now()
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, cardPayload(user.Subjects[si], *card))
}

func (a *App) DeleteFlashcard(c *gin.Context) {
	user, si, ci, ok := a.cardFromRequest(c)
	if !ok {
		return
	}
	user.Subjects[si].Flashcards = append(user.Subjects[si].Flashcards[:ci], user.Subjects[si].Flashcards[ci+1:]...)
	if !a.saveUser(c, &user) {
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *App) ReviewFlashcard(c *gin.Context) {
	user, si, ci, ok := a.cardFromRequest(c)
	if !ok {
		return
	}
	now := time.Now()
	card := &user.Subjects[si].Flashcards[ci]
	card.LastReviewedAt, card.ReviewCount, card.UpdatedAt = &now, card.ReviewCount+1, now
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusOK, cardPayload(user.Subjects[si], *card))
}

func (a *App) ListEvents(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	subjectID := c.Param("subjectId")
	date, importance := c.Query("date"), c.Query("importance")
	_, _, events := a.flatten(&user)
	result := []gin.H{}
	for _, event := range events {
		if subjectID != "" && event["subjectId"] != subjectID {
			continue
		}
		if date != "" && event["date"] != date {
			continue
		}
		if importance != "" && event["importance"] != importance {
			continue
		}
		result = append(result, event)
	}
	sortEvents(result)
	c.JSON(http.StatusOK, result)
}

func (a *App) CreateEvent(c *gin.Context) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	var input struct {
		SubjectID   string `json:"subjectId"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Date        string `json:"date" binding:"required"`
		Time        string `json:"time"`
		Importance  string `json:"importance"`
		Priority    string `json:"priority"`
	}
	if !bind(c, &input) {
		return
	}
	subjectID := fallback(c.Param("subjectId"), input.SubjectID)
	now := time.Now()
	event := models.EventNode{ID: newID("event"), Title: input.Title, Description: input.Description, Date: input.Date, Time: fallback(input.Time, now.Format("15:04")), Importance: fallback(input.Importance, fallback(input.Priority, "low")), CreatedAt: now, UpdatedAt: now}
	if subjectID == "" {
		user.Events = append(user.Events, event)
	} else if si := indexSubject(user.Subjects, subjectID); si >= 0 {
		user.Subjects[si].Events = append(user.Subjects[si].Events, event)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "subject not found"})
		return
	}
	if !a.saveUser(c, &user) {
		return
	}
	c.JSON(http.StatusCreated, eventPayload(subjectID, subjectTitle(&user, subjectID), subjectColor(&user, subjectID), event))
}

func (a *App) UpdateEvent(c *gin.Context) {
	user, subjectID, ei, global, ok := a.eventFromRequest(c)
	if !ok {
		return
	}
	var input struct {
		SubjectID   string `json:"subjectId"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Date        string `json:"date" binding:"required"`
		Time        string `json:"time"`
		Importance  string `json:"importance"`
		Priority    string `json:"priority"`
	}
	if !bind(c, &input) {
		return
	}
	now := time.Now()
	apply := func(event *models.EventNode) {
		event.Title, event.Description, event.Date = input.Title, input.Description, input.Date
		event.Time, event.Importance, event.UpdatedAt = fallback(input.Time, now.Format("15:04")), fallback(input.Importance, fallback(input.Priority, "low")), now
	}
	if global {
		apply(&user.Events[ei])
	} else {
		si := indexSubject(user.Subjects, subjectID)
		apply(&user.Subjects[si].Events[ei])
	}
	if !a.saveUser(c, &user) {
		return
	}
	c.Status(http.StatusOK)
}

func (a *App) DeleteEvent(c *gin.Context) {
	user, subjectID, ei, global, ok := a.eventFromRequest(c)
	if !ok {
		return
	}
	if global {
		user.Events = append(user.Events[:ei], user.Events[ei+1:]...)
	} else {
		si := indexSubject(user.Subjects, subjectID)
		user.Subjects[si].Events = append(user.Subjects[si].Events[:ei], user.Subjects[si].Events[ei+1:]...)
	}
	if !a.saveUser(c, &user) {
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *App) UpcomingEvents(c *gin.Context) { a.eventsList(c, 8) }
func (a *App) EventFeed(c *gin.Context)      { a.eventsList(c, 20) }
func (a *App) RecentNotes(c *gin.Context) {
	user, ok := a.currentUser(c)
	if ok {
		notes, _, _ := a.flatten(&user)
		c.JSON(http.StatusOK, latest(notes, "createdAt", 8))
	}
}
func (a *App) RecentFlashcards(c *gin.Context) {
	user, ok := a.currentUser(c)
	if ok {
		_, cards, _ := a.flatten(&user)
		c.JSON(http.StatusOK, latest(cards, "createdAt", 8))
	}
}
func (a *App) Recommendations(c *gin.Context) {
	user, ok := a.currentUser(c)
	if ok {
		c.JSON(http.StatusOK, a.buildRecommendations(&user))
	}
}

func (a *App) eventsList(c *gin.Context, limit int) {
	user, ok := a.currentUser(c)
	if !ok {
		return
	}
	_, _, events := a.flatten(&user)
	c.JSON(http.StatusOK, filterUpcoming(events, limit))
}

func (a *App) flatten(user *models.User) ([]gin.H, []gin.H, []gin.H) {
	notes, cards, events := []gin.H{}, []gin.H{}, []gin.H{}
	for _, subject := range user.Subjects {
		for _, note := range subject.Notes {
			notes = append(notes, notePayload(subject, note))
		}
		for _, card := range subject.Flashcards {
			cards = append(cards, cardPayload(subject, card))
		}
		for _, event := range subject.Events {
			events = append(events, eventPayload(subject.ID, subject.Title, subject.ColorKey, event))
		}
	}
	for _, event := range user.Events {
		events = append(events, eventPayload("", "", "gray", event))
	}
	sortEvents(events)
	return notes, cards, events
}

func notePayload(subject models.SubjectNode, note models.NoteNode) gin.H {
	return gin.H{"id": note.ID, "subjectId": subject.ID, "subjectTitle": subject.Title, "subjectColorKey": subject.ColorKey, "title": note.Title, "content": note.Content, "date": note.Date, "files": note.Files, "createdAt": note.CreatedAt, "updatedAt": note.UpdatedAt}
}
func cardPayload(subject models.SubjectNode, card models.FlashcardNode) gin.H {
	return gin.H{"id": card.ID, "subjectId": subject.ID, "subjectTitle": subject.Title, "subjectColorKey": subject.ColorKey, "question": card.Question, "answer": card.Answer, "date": card.Date, "lastReviewedAt": card.LastReviewedAt, "reviewCount": card.ReviewCount, "createdAt": card.CreatedAt, "updatedAt": card.UpdatedAt}
}
func eventPayload(subjectID, title, color string, event models.EventNode) gin.H {
	return gin.H{"id": event.ID, "subjectId": subjectID, "subjectTitle": title, "subjectColorKey": color, "title": event.Title, "description": event.Description, "date": event.Date, "time": event.Time, "importance": event.Importance, "createdAt": event.CreatedAt, "updatedAt": event.UpdatedAt}
}

func (a *App) stats(user *models.User) models.Stats {
	var s models.Stats
	s.Subjects = int64(len(user.Subjects))
	s.Events = int64(len(user.Events))
	for _, subject := range user.Subjects {
		s.Notes += int64(len(subject.Notes))
		s.Flashcards += int64(len(subject.Flashcards))
		s.Events += int64(len(subject.Events))
	}
	return s
}

func (a *App) buildRecommendations(user *models.User) []models.Recommendation {
	_, cards, events := a.flatten(user)
	today := time.Now().Format("2006-01-02")
	recs := []models.Recommendation{}
	todayCount := 0
	for _, event := range events {
		if event["date"] == today {
			todayCount++
		}
	}
	if todayCount > 0 {
		recs = append(recs, models.Recommendation{Type: "today_events", Title: "Проверьте события дня", Text: fmt.Sprintf("Сегодня запланировано событий: %d.", todayCount), Priority: "high"})
	} else {
		recs = append(recs, models.Recommendation{Type: "planning", Title: "Запланируйте учебную задачу", Text: "На сегодня нет событий. Добавьте повторение или практику.", Priority: "low"})
	}
	stale := 0
	for _, card := range cards {
		if card["lastReviewedAt"] == nil {
			stale++
		}
	}
	if stale > 0 {
		recs = append(recs, models.Recommendation{Type: "flashcard_review", Title: "Повторите карточки", Text: fmt.Sprintf("Карточек для повторения: %d.", stale), Priority: "medium"})
	}
	for _, subject := range user.Subjects {
		if len(subject.Notes) > 0 && len(subject.Flashcards) == 0 {
			recs = append(recs, models.Recommendation{Type: "note_to_flashcards", Title: "Добавьте карточки", Text: "Создайте карточки по заметкам предмета \"" + subject.Title + "\".", Priority: "medium"})
			break
		}
	}
	return recs
}

func (a *App) findUserByEmail(c *gin.Context, email string) (models.User, error) {
	var user models.User
	err := a.DB.Collection("users").FindOne(c, bson.M{"email": email}).Decode(&user)
	if err == nil {
		a.normalizeUser(&user)
	}
	return user, err
}
func (a *App) currentUser(c *gin.Context) (models.User, bool) {
	var user models.User
	err := a.DB.Collection("users").FindOne(c, bson.M{"_id": mustUserID(c)}).Decode(&user)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден. Войдите снова."})
			return user, false
		}
		serverError(c, err)
		return user, false
	}
	hadLegacyAvatar := user.LegacyAvatarURL != ""
	a.normalizeUser(&user)
	sessionID := mustSessionID(c)
	now := time.Now()
	sessions := validSessions(user.Sessions, now)
	sessionIndex := indexSession(sessions, sessionID)
	if sessionIndex < 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Сессия завершена. Войдите снова."})
		return user, false
	}
	if len(sessions) != len(user.Sessions) || now.Sub(sessions[sessionIndex].LastSeenAt) > 5*time.Minute || hadLegacyAvatar {
		sessions[sessionIndex].LastSeenAt = now
		user.Sessions = sessions
		user.LegacyAvatarURL = ""
		_ = a.saveUser(c, &user)
	}
	return user, true
}
func (a *App) normalizeUser(user *models.User) {
	if user.Avatar == "" && user.LegacyAvatarURL != "" {
		user.Avatar = user.LegacyAvatarURL
	}
	user.LegacyAvatarURL = ""
}
func (a *App) saveUser(c *gin.Context, user *models.User) bool {
	a.normalizeUser(user)
	user.UpdatedAt = time.Now()
	_, err := a.DB.Collection("users").ReplaceOne(c, bson.M{"_id": user.ID}, user)
	if err != nil {
		serverError(c, err)
		return false
	}
	return true
}

func (a *App) subjectFromRequest(c *gin.Context) (models.User, int, bool) {
	user, ok := a.currentUser(c)
	id := fallback(c.Param("subjectId"), c.Param("id"))
	if !ok {
		return user, -1, false
	}
	if i := indexSubject(user.Subjects, id); i >= 0 {
		return user, i, true
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "subject not found"})
	return user, -1, false
}
func (a *App) subjectForNestedOrBody(c *gin.Context) (models.User, int, bool) {
	if c.Param("subjectId") != "" {
		return a.subjectFromRequest(c)
	}
	var input struct {
		SubjectID string `json:"subjectId"`
	}
	_ = c.ShouldBindBodyWith(&input, binding.JSON)
	user, ok := a.currentUser(c)
	if !ok {
		return user, -1, false
	}
	if i := indexSubject(user.Subjects, input.SubjectID); i >= 0 {
		return user, i, true
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "subject not found"})
	return user, -1, false
}
func (a *App) noteFromRequest(c *gin.Context) (models.User, int, int, bool) {
	user, si, ok := a.subjectForNestedOrBody(c)
	noteID := fallback(c.Param("noteId"), c.Param("id"))
	if !ok {
		return user, -1, -1, false
	}
	for i, note := range user.Subjects[si].Notes {
		if note.ID == noteID {
			return user, si, i, true
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
	return user, -1, -1, false
}
func (a *App) cardFromRequest(c *gin.Context) (models.User, int, int, bool) {
	user, si, ok := a.subjectForNestedOrBody(c)
	cardID := fallback(c.Param("cardId"), c.Param("id"))
	if !ok {
		return user, -1, -1, false
	}
	for i, card := range user.Subjects[si].Flashcards {
		if card.ID == cardID {
			return user, si, i, true
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
	return user, -1, -1, false
}
func (a *App) eventFromRequest(c *gin.Context) (models.User, string, int, bool, bool) {
	user, ok := a.currentUser(c)
	eventID := fallback(c.Param("eventId"), c.Param("id"))
	subjectID := c.Param("subjectId")
	if !ok {
		return user, "", -1, false, false
	}
	if subjectID != "" {
		si := indexSubject(user.Subjects, subjectID)
		if si < 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "subject not found"})
			return user, "", -1, false, false
		}
		for i, event := range user.Subjects[si].Events {
			if event.ID == eventID {
				return user, subjectID, i, false, true
			}
		}
	}
	for i, event := range user.Events {
		if event.ID == eventID {
			return user, "", i, true, true
		}
	}
	for _, subject := range user.Subjects {
		for i, event := range subject.Events {
			if event.ID == eventID {
				return user, subject.ID, i, false, true
			}
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
	return user, "", -1, false, false
}

func indexSubject(subjects []models.SubjectNode, id string) int {
	for i, subject := range subjects {
		if subject.ID == id {
			return i
		}
	}
	return -1
}
func subjectTitle(user *models.User, id string) string {
	if i := indexSubject(user.Subjects, id); i >= 0 {
		return user.Subjects[i].Title
	}
	return ""
}
func subjectColor(user *models.User, id string) string {
	if i := indexSubject(user.Subjects, id); i >= 0 {
		return user.Subjects[i].ColorKey
	}
	return "gray"
}
func (a *App) removeNoteFiles(note models.NoteNode) {
	for _, file := range note.Files {
		_ = os.Remove(filepath.Join(a.UploadDir, file.FileName))
	}
}
func filterUpcoming(events []gin.H, limit int) []gin.H {
	today := time.Now().Format("2006-01-02")
	result := []gin.H{}
	for _, event := range events {
		if fmt.Sprint(event["date"]) >= today {
			result = append(result, event)
		}
	}
	sortEvents(result)
	if len(result) > limit {
		return result[:limit]
	}
	return result
}
func latest(items []gin.H, field string, limit int) []gin.H {
	sort.Slice(items, func(i, j int) bool {
		ti, _ := items[i][field].(time.Time)
		tj, _ := items[j][field].(time.Time)
		return ti.After(tj)
	})
	if len(items) > limit {
		return items[:limit]
	}
	return items
}
func sortEvents(events []gin.H) {
	sort.Slice(events, func(i, j int) bool {
		return fmt.Sprint(events[i]["date"])+fmt.Sprint(events[i]["time"]) < fmt.Sprint(events[j]["date"])+fmt.Sprint(events[j]["time"])
	})
}
func newID(prefix string) string { return prefix + "_" + primitive.NewObjectID().Hex() }
func (a *App) newSession(c *gin.Context, now time.Time) models.SessionNode {
	return models.SessionNode{
		ID:         newID("session"),
		UserAgent:  c.GetHeader("User-Agent"),
		IP:         c.ClientIP(),
		CreatedAt:  now,
		LastSeenAt: now,
		ExpiresAt:  now.Add(a.JWTExpiresIn),
	}
}
func validSessions(sessions []models.SessionNode, now time.Time) []models.SessionNode {
	result := make([]models.SessionNode, 0, len(sessions))
	for _, session := range sessions {
		if session.ExpiresAt.After(now) {
			result = append(result, session)
		}
	}
	return result
}
func indexSession(sessions []models.SessionNode, id string) int {
	for i, session := range sessions {
		if session.ID == id {
			return i
		}
	}
	return -1
}
func mustUserID(c *gin.Context) primitive.ObjectID {
	return c.MustGet("userId").(primitive.ObjectID)
}
func mustSessionID(c *gin.Context) string {
	return c.MustGet("sessionId").(string)
}
func bind(c *gin.Context, target any) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return false
	}
	return true
}
func serverError(c *gin.Context, err error) {
	if errors.Is(err, mongo.ErrNoDocuments) {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}
func fallback(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}
func isImageFile(mimeType, fileName string) bool {
	if strings.HasPrefix(mimeType, "image/") {
		return true
	}
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".jpg", ".jpeg", ".png", ".webp":
		return true
	default:
		return false
	}
}
func (a *App) allowedMimeType(mimeType, fileName string) bool {
	if a.AllowedTypes[mimeType] {
		return true
	}
	ext := strings.ToLower(filepath.Ext(fileName))
	return a.AllowedTypes[map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf", ".txt": "text/plain"}[ext]]
}
