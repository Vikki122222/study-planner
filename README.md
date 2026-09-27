# Study Planner

Учебный веб-сервис для предметов, заметок, карточек запоминания, файлов и календарных событий.

## Запуск

Из корня проекта:

```bash
go run . all
```

Отдельно backend:

```bash
go run . back
```

Отдельно frontend:

```bash
go run . front
```

Перед первым запуском frontend-зависимости:

```bash
cd frontend
npm install
```

Backend читает настройки из `backend/.env`. Нужен запущенный MongoDB по `MONGO_URI`.

## Стек

- Backend: Go, Gin, MongoDB driver, JWT, bcrypt, godotenv
- Frontend: React, Vite, React Router, Axios
- Database: MongoDB

## Новая модель данных

Учебные данные хранятся внутри документа пользователя:

- `users.subjects[]`
- `subjects[].notes[]`
- `subjects[].flashcards[]`
- `subjects[].events[]`
- `users.events[]` для общих событий

Удаление предмета удаляет вложенные заметки, карточки, события и файлы заметок с диска.

## Основные API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/calendar/month?year=2026&month=4`
- `GET /api/day?date=2026-04-30`
- `GET|POST /api/subjects`
- `PUT|DELETE /api/subjects/:subjectId`
- `GET|POST /api/subjects/:subjectId/notes`
- `PUT|DELETE /api/subjects/:subjectId/notes/:noteId`
- `POST /api/subjects/:subjectId/notes/:noteId/files`
- `DELETE /api/subjects/:subjectId/notes/:noteId/files/:fileId`
- `GET|POST /api/subjects/:subjectId/flashcards`
- `PUT|DELETE /api/subjects/:subjectId/flashcards/:cardId`
- `POST /api/subjects/:subjectId/flashcards/:cardId/review`
- `GET|POST /api/events`
- `GET /api/events/feed`
- `GET /api/events/upcoming`
- `GET|POST /api/subjects/:subjectId/events`
- `GET|PUT /api/profile`
- `PUT /api/profile/password`
- `GET /api/sessions`
- `DELETE /api/sessions/:sessionId`
