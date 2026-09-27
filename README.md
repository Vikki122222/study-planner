# 📚 Study Planner

> **Study Planner** — full-stack веб-приложение для организации учебного процесса: предметы, заметки, карточки для повторения, календарь, события, файлы и личный профиль в одном месте.

<p align="center">
  <b>Планируйте учебу • Храните материалы • Повторяйте важное</b>
</p>

---

## 📌 О проекте

Study Planner создан как учебный командный проект, цель которого — собрать основные инструменты для учебы в одном удобном веб-приложении.

Пользователь может зарегистрироваться, добавить учебные предметы, создавать заметки и карточки для повторения, прикреплять файлы, планировать события в календаре и отслеживать свою учебную активность.

В процессе разработки использовались современные AI-инструменты как вспомогательный инструмент для поиска решений, ускорения разработки и работы с кодом. При этом структура проекта, объединение frontend и backend, настройка приложения, проверка пользовательских сценариев и финальная доработка выполнялись в рамках совместной работы команды.

---

## 🖼️ Интерфейс

### Экран входа

![Экран входа Study Planner](docs/screenshots/login.png)

### Профиль пользователя

![Профиль пользователя Study Planner](docs/screenshots/profile.png)

### Главный экран и календарь

![Главный экран и календарь Study Planner](docs/screenshots/dashboard.png)

---

## ✨ Возможности

- регистрация и авторизация пользователей;
- защищенная авторизация с использованием JWT;
- создание, редактирование и удаление учебных предметов;
- создание заметок для отдельных предметов;
- прикрепление файлов к заметкам;
- карточки формата «вопрос — ответ» для повторения материала;
- отметка повторений карточек;
- календарь с учебными событиями;
- создание общих событий и событий, связанных с предметом;
- отображение ближайших и важных событий;
- статистика по предметам, заметкам, карточкам и событиям;
- профиль пользователя;
- загрузка аватара;
- изменение пароля;
- управление активными сессиями;
- адаптивный интерфейс на React.

---

## 🛠️ Технологии

| Часть проекта | Технологии |
|---|---|
| **Frontend** | React, Vite, React Router, Axios, Lucide React |
| **Backend** | Go, Gin |
| **База данных** | MongoDB |
| **Авторизация** | JWT, bcrypt |
| **Конфигурация** | godotenv |
| **API** | REST API |
| **Файлы** | Локальное хранилище backend + данные в MongoDB |

---

## 🏗️ Структура проекта

```text
study-planner/
│
├── backend/
│   ├── cmd/
│   │   └── server/              # Точка запуска backend
│   ├── internal/
│   │   ├── config/              # Конфигурация
│   │   ├── handlers/            # HTTP-обработчики
│   │   ├── middleware/          # Middleware и JWT
│   │   └── models/              # Модели данных
│   ├── pkg/
│   │   ├── database/            # Подключение к MongoDB
│   │   └── utils/               # Вспомогательные функции
│   ├── uploads/                 # Загруженные файлы
│   ├── .env                     # Локальные настройки (не публикуется)
│   └── go.mod
│
├── frontend/
│   ├── src/
│   │   ├── components/          # UI-компоненты
│   │   ├── context/             # Контексты приложения
│   │   ├── pages/               # Страницы
│   │   ├── services/            # Работа с API
│   │   └── styles/              # Стили
│   ├── .env                     # Локальные настройки (не публикуется)
│   └── package.json
│
├── docs/
│   └── screenshots/             # Скриншоты для README
│
├── .gitignore
├── go.mod
├── main.go                      # Общий запуск frontend/backend
└── README.md
```

Frontend отвечает за пользовательский интерфейс и взаимодействует с REST API. Backend обрабатывает запросы, авторизацию, бизнес-логику, работу с MongoDB и загрузку файлов.

---

## 🗃️ Модель данных

Учебные данные связаны с пользователем и его предметами.

```text
User
├── profile
├── sessions[]
├── subjects[]
│   ├── notes[]
│   ├── flashcards[]
│   └── events[]
└── events[]
```

Основные учебные сущности:

- `users.subjects[]` — предметы пользователя;
- `subjects[].notes[]` — заметки;
- `subjects[].flashcards[]` — карточки для повторения;
- `subjects[].events[]` — события конкретного предмета;
- `users.events[]` — общие события пользователя.

При удалении предмета удаляются связанные с ним заметки, карточки, события и файлы заметок.

---

## 🚀 Запуск проекта

### Требования

Перед запуском необходимо установить:

- **Go**;
- **Node.js** и **npm**;
- **MongoDB**.

Проверить установку:

```bash
go version
node -v
npm -v
```

### 1. Клонирование

```bash
git clone https://github.com/Vikki122222/study-planner.git
cd study-planner
```

### 2. Установка frontend-зависимостей

```bash
cd frontend
npm install
cd ..
```

### 3. Настройка backend

Backend использует файл:

```text
backend/.env
```

Пример настроек:

```env
APP_PORT=8080
APP_ENV=development
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=studyplanner
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=336h
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=10
```

> [!IMPORTANT]
> Файл `.env` содержит локальные настройки и секреты. Его не нужно загружать в GitHub.

### 4. Настройка frontend

Создайте или проверьте файл:

```text
frontend/.env
```

Пример:

```env
VITE_API_URL=http://localhost:8080/api
```

### 5. MongoDB

Перед запуском приложения MongoDB должна быть запущена и доступна по адресу, указанному в `MONGO_URI`.

---

## ▶️ Быстрый запуск

Из корня проекта можно запустить frontend и backend одной командой:

```bash
go run . all
```

После запуска приложение обычно доступно по адресу:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:8080/api
```

### Запустить только backend

```bash
go run . back
```

или:

```bash
cd backend
go run ./cmd/server
```

### Запустить только frontend

```bash
go run . front
```

или:

```bash
cd frontend
npm run dev
```

---

## 🔌 Основные API-маршруты

### Авторизация

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
```

### Dashboard и календарь

```text
GET    /api/dashboard
GET    /api/calendar/month?year=2026&month=4
GET    /api/day?date=2026-04-30
```

### Предметы

```text
GET    /api/subjects
POST   /api/subjects
PUT    /api/subjects/:subjectId
DELETE /api/subjects/:subjectId
```

### Заметки

```text
GET    /api/subjects/:subjectId/notes
POST   /api/subjects/:subjectId/notes
PUT    /api/subjects/:subjectId/notes/:noteId
DELETE /api/subjects/:subjectId/notes/:noteId
POST   /api/subjects/:subjectId/notes/:noteId/files
DELETE /api/subjects/:subjectId/notes/:noteId/files/:fileId
```

### Карточки

```text
GET    /api/subjects/:subjectId/flashcards
POST   /api/subjects/:subjectId/flashcards
PUT    /api/subjects/:subjectId/flashcards/:cardId
DELETE /api/subjects/:subjectId/flashcards/:cardId
POST   /api/subjects/:subjectId/flashcards/:cardId/review
```

### События

```text
GET    /api/events
POST   /api/events
GET    /api/events/feed
GET    /api/events/upcoming
GET    /api/subjects/:subjectId/events
POST   /api/subjects/:subjectId/events
```

### Профиль и сессии

```text
GET    /api/profile
PUT    /api/profile
PUT    /api/profile/password
GET    /api/sessions
DELETE /api/sessions/:sessionId
```

---

## 🔐 Безопасность

В проекте реализованы базовые меры безопасности:

- пароли хэшируются с помощью `bcrypt`;
- защищенные запросы используют JWT;
- пользовательские сессии можно просматривать и завершать;
- файлы `.env` исключаются из Git;
- `node_modules`, загруженные файлы и результаты сборки не должны публиковаться в репозитории.

Перед публикацией изменений рекомендуется выполнять:

```bash
git status
```

и проверять, что секретные или локальные файлы не попали в коммит.

---

## 📤 Работа с GitHub

После изменений:

```bash
git add .
git commit -m "Update project"
git push
```

Для первого подключения репозитория:

```bash
git branch -M main
git remote add origin https://github.com/Vikki122222/study-planner.git
git push -u origin main
```

Если `origin` уже был добавлен:

```bash
git remote -v
```

При необходимости изменить адрес:

```bash
git remote set-url origin https://github.com/Vikki122222/study-planner.git
```

---

## 🔮 Что можно добавить в будущем

- интервальное повторение карточек;
- уведомления о ближайших событиях;
- восстановление пароля;
- подтверждение email;
- drag-and-drop загрузку файлов;
- тесты frontend и backend;
- Docker Compose для быстрого запуска;
- CI/CD через GitHub Actions;
- облачное хранение файлов;
- развертывание приложения на сервере.

---

## 👥 Команда

Проект выполнен **командой из трёх человек**. Все участники принимали участие в совместной разработке, проверке и доработке итогового приложения.

| Участник | Участие в проекте |
|---|---|
| **Алексей Хромышев** | Совместная разработка проекта, проверка функциональности и доработка приложения |
| **Павел Сидлецкий** | Совместная разработка проекта, проверка функциональности и доработка приложения |
| **Виктория Сутормина** | Совместная разработка проекта, проверка функциональности и доработка приложения |

---

<p align="center">
  <b>Study Planner — учебный проект, созданный командой из трёх человек.</b>
</p>
