# Cinema App (Web + Desktop)

Многостраничное приложение кинотеатра:
- backend: Node.js (`http`) + REST API
- frontend: HTML/CSS/JS
- лёгкая БД: `db.json` (файловая)
- desktop: Electron

## Запуск (Web)

```bash
cd /Users/stanislav/Desktop/Ibra
npm start
```

Открыть: `http://127.0.0.1:3000`

## Запуск (Desktop)

1. Установи зависимости:

```bash
cd /Users/stanislav/Desktop/Ibra
npm install
```

2. Запусти desktop-приложение:

```bash
npm run desktop
```

Electron поднимет локальный backend автоматически внутри приложения (порт `3210`).

## Страницы

- `/index.html` - главная
- `/auth.html` - вход и регистрация
- `/movies.html` - афиша, выбор мест, бронирование
- `/bookings.html` - мои брони и отмена

## API

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Cinema
- `GET /api/movies` - фильмы + сеансы
- `GET /api/sessions?movieId=1` - сеансы (опционально по фильму)
- `GET /api/sessions/:id/seats` - занятые/свободные места
- `POST /api/bookings` - создать бронь (требуется `Authorization: Bearer <token>`)
- `GET /api/bookings/my` - список своих броней
- `DELETE /api/bookings/:id` - отмена своей брони
