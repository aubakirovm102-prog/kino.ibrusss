const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readDb, writeDb, getNextId } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function ensureDbStructure(db) {
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.authTokens)) db.authTokens = [];
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getTokenFromReq(req) {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

function getUserByToken(db, token) {
  if (!token) return null;
  const auth = db.authTokens.find((item) => item.token === token);
  if (!auth) return null;
  return db.users.find((u) => u.id === auth.userId) || null;
}

function getBookedSeats(db, sessionId) {
  return db.bookings
    .filter((b) => b.sessionId === sessionId)
    .flatMap((b) => b.seats);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    createdAt: user.createdAt,
  };
}

function enrichBooking(db, booking) {
  const session = db.sessions.find((s) => s.id === booking.sessionId);
  const movie = session ? db.movies.find((m) => m.id === session.movieId) : null;
  return {
    ...booking,
    session: session || null,
    movie: movie || null,
  };
}

function handleApi(req, res, url) {
  const db = readDb();
  ensureDbStructure(db);

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    return parseBody(req)
      .then((body) => {
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        const fullName = String(body.fullName || '').trim();

        if (!username || !password || !fullName) {
          return sendJson(res, 400, { error: 'username, fullName и password обязательны' });
        }

        if (!/^[a-z0-9_]{3,24}$/.test(username)) {
          return sendJson(res, 400, {
            error: 'username: 3-24 символа, латиница/цифры/нижнее подчёркивание',
          });
        }

        if (password.length < 6) {
          return sendJson(res, 400, { error: 'password минимум 6 символов' });
        }

        const exists = db.users.some((u) => u.username === username);
        if (exists) return sendJson(res, 409, { error: 'Пользователь уже существует' });

        const salt = crypto.randomBytes(16).toString('hex');
        const user = {
          id: getNextId(db.users),
          username,
          fullName,
          passwordSalt: salt,
          passwordHash: hashPassword(password, salt),
          createdAt: new Date().toISOString(),
        };

        db.users.push(user);
        writeDb(db);

        return sendJson(res, 201, { user: sanitizeUser(user) });
      })
      .catch((error) => {
        const code = error.message === 'Invalid JSON' ? 400 : 500;
        return sendJson(res, code, { error: error.message });
      });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    return parseBody(req)
      .then((body) => {
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');

        const user = db.users.find((u) => u.username === username);
        if (!user) return sendJson(res, 401, { error: 'Неверный логин или пароль' });

        const hash = hashPassword(password, user.passwordSalt);
        if (hash !== user.passwordHash) {
          return sendJson(res, 401, { error: 'Неверный логин или пароль' });
        }

        const token = createToken();
        db.authTokens.push({
          token,
          userId: user.id,
          createdAt: new Date().toISOString(),
        });
        writeDb(db);

        return sendJson(res, 200, {
          token,
          user: sanitizeUser(user),
        });
      })
      .catch((error) => {
        const code = error.message === 'Invalid JSON' ? 400 : 500;
        return sendJson(res, code, { error: error.message });
      });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const token = getTokenFromReq(req);
    const user = getUserByToken(db, token);
    if (!user) return sendJson(res, 401, { error: 'Требуется авторизация' });
    return sendJson(res, 200, { user: sanitizeUser(user) });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = getTokenFromReq(req);
    if (!token) return sendJson(res, 200, { ok: true });

    db.authTokens = db.authTokens.filter((item) => item.token !== token);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/movies') {
    const movies = db.movies.map((movie) => ({
      ...movie,
      sessions: db.sessions.filter((session) => session.movieId === movie.id),
    }));
    return sendJson(res, 200, movies);
  }

  if (req.method === 'GET' && url.pathname === '/api/sessions') {
    const movieId = Number(url.searchParams.get('movieId'));
    const sessions = Number.isNaN(movieId)
      ? db.sessions
      : db.sessions.filter((session) => session.movieId === movieId);
    return sendJson(res, 200, sessions);
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/sessions/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 4 && parts[3] === 'seats') {
      const sessionId = Number(parts[2]);
      const session = db.sessions.find((s) => s.id === sessionId);
      if (!session) return sendJson(res, 404, { error: 'Session not found' });
      return sendJson(res, 200, {
        sessionId,
        totalSeats: session.totalSeats,
        bookedSeats: getBookedSeats(db, sessionId),
      });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/bookings/my') {
    const token = getTokenFromReq(req);
    const user = getUserByToken(db, token);
    if (!user) return sendJson(res, 401, { error: 'Требуется авторизация' });

    const bookings = db.bookings
      .filter((b) => b.userId === user.id)
      .map((booking) => enrichBooking(db, booking))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return sendJson(res, 200, bookings);
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/bookings/')) {
    const token = getTokenFromReq(req);
    const user = getUserByToken(db, token);
    if (!user) return sendJson(res, 401, { error: 'Требуется авторизация' });

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 3) {
      const bookingId = Number(parts[2]);
      const booking = db.bookings.find((b) => b.id === bookingId);

      if (!booking) return sendJson(res, 404, { error: 'Бронь не найдена' });
      if (booking.userId !== user.id) {
        return sendJson(res, 403, { error: 'Нельзя удалять чужую бронь' });
      }

      db.bookings = db.bookings.filter((b) => b.id !== bookingId);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    return parseBody(req)
      .then((body) => {
        const token = getTokenFromReq(req);
        const user = getUserByToken(db, token);
        if (!user) return sendJson(res, 401, { error: 'Войди в аккаунт для бронирования' });

        const sessionId = Number(body.sessionId);
        const seats = Array.isArray(body.seats) ? body.seats.map(Number) : [];

        if (!sessionId || !seats.length) {
          return sendJson(res, 400, { error: 'sessionId и seats обязательны' });
        }

        const session = db.sessions.find((s) => s.id === sessionId);
        if (!session) return sendJson(res, 404, { error: 'Session not found' });

        const validSeats = seats.every(
          (seat) => Number.isInteger(seat) && seat >= 1 && seat <= session.totalSeats
        );
        if (!validSeats) {
          return sendJson(res, 400, { error: 'Некорректные номера мест' });
        }

        const uniqueSeats = [...new Set(seats)];
        const bookedSeats = getBookedSeats(db, sessionId);
        const busySeats = uniqueSeats.filter((seat) => bookedSeats.includes(seat));

        if (busySeats.length) {
          return sendJson(res, 409, {
            error: `Места уже заняты: ${busySeats.join(', ')}`,
            busySeats,
          });
        }

        const booking = {
          id: getNextId(db.bookings),
          sessionId,
          userId: user.id,
          customerName: user.fullName,
          seats: uniqueSeats,
          createdAt: new Date().toISOString(),
        };

        db.bookings.push(booking);
        writeDb(db);

        return sendJson(res, 201, enrichBooking(db, booking));
      })
      .catch((error) => {
        const code = error.message === 'Invalid JSON' ? 400 : 500;
        return sendJson(res, code, { error: error.message });
      });
  }

  sendJson(res, 404, { error: 'API route not found' });
}

function serveStatic(req, res, url) {
  const relativePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(PUBLIC_DIR, relativePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url);
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`Cinema app is running: http://${HOST}:${PORT}`);
});
