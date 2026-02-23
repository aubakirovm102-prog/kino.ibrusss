const moviesEl = document.getElementById('movies');
const seatsEl = document.getElementById('seats');
const statusEl = document.getElementById('status');
const formEl = document.getElementById('booking-form');
const selectedSessionTitleEl = document.getElementById('selected-session-title');

const tabLoginEl = document.getElementById('tab-login');
const tabRegisterEl = document.getElementById('tab-register');
const loginFormEl = document.getElementById('login-form');
const registerFormEl = document.getElementById('register-form');
const authStatusEl = document.getElementById('auth-status');
const userBoxEl = document.getElementById('user-box');
const userInfoEl = document.getElementById('user-info');
const logoutBtnEl = document.getElementById('logout-btn');

const loginUsernameEl = document.getElementById('login-username');
const loginPasswordEl = document.getElementById('login-password');
const registerFullnameEl = document.getElementById('register-fullname');
const registerUsernameEl = document.getElementById('register-username');
const registerPasswordEl = document.getElementById('register-password');

let selectedSession = null;
let selectedSeats = new Set();
let authToken = localStorage.getItem('cinema_token') || null;
let currentUser = null;

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function setAuthStatus(message, type = '') {
  authStatusEl.textContent = message;
  authStatusEl.className = `status ${type}`.trim();
}

function switchTab(type) {
  const login = type === 'login';
  tabLoginEl.classList.toggle('active', login);
  tabRegisterEl.classList.toggle('active', !login);
  loginFormEl.classList.toggle('active', login);
  registerFormEl.classList.toggle('active', !login);
}

function updateUserUI() {
  const loggedIn = Boolean(currentUser);

  userBoxEl.classList.toggle('hidden', !loggedIn);
  loginFormEl.classList.toggle('hidden', loggedIn);
  registerFormEl.classList.toggle('hidden', loggedIn);
  document.querySelector('.tabs').classList.toggle('hidden', loggedIn);

  if (loggedIn) {
    userInfoEl.textContent = `Ты вошел как: ${currentUser.fullName} (@${currentUser.username})`;
  }
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function loadCurrentUser() {
  if (!authToken) {
    currentUser = null;
    updateUserUI();
    return;
  }

  const { response, data } = await api('/api/auth/me');

  if (!response.ok) {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('cinema_token');
    updateUserUI();
    return;
  }

  currentUser = data.user;
  updateUserUI();
}

async function loadMovies() {
  const { response, data } = await api('/api/movies');
  if (!response.ok) {
    setStatus('Не удалось загрузить фильмы', 'error');
    return;
  }

  const movies = data;
  moviesEl.innerHTML = '';

  movies.forEach((movie) => {
    const card = document.createElement('article');
    card.className = 'movie-card';

    const sessionsHtml = movie.sessions
      .map(
        (session) =>
          `<button class="session-btn" data-session-id="${session.id}" data-movie-title="${movie.title}">
            ${formatDate(session.startTime)} | ${session.hall} | ${session.price} ₽
          </button>`
      )
      .join('');

    card.innerHTML = `
      <h3>${movie.title}</h3>
      <p>${movie.description}</p>
      <p class="movie-meta">${movie.durationMin} мин | ${movie.ageRating}</p>
      <div class="sessions">${sessionsHtml || '<span>Сеансов нет</span>'}</div>
    `;

    moviesEl.appendChild(card);
  });

  moviesEl.querySelectorAll('.session-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sessionId = Number(btn.dataset.sessionId);
      const movieTitle = btn.dataset.movieTitle;
      selectSession(sessionId, movieTitle);
    });
  });
}

async function selectSession(sessionId, movieTitle) {
  selectedSession = sessionId;
  selectedSeats = new Set();
  selectedSessionTitleEl.textContent = `Сеанс: ${movieTitle}`;
  setStatus('Выбери места');

  const { response, data } = await api(`/api/sessions/${sessionId}/seats`);
  if (!response.ok) {
    setStatus(data.error || 'Ошибка загрузки мест', 'error');
    return;
  }

  seatsEl.innerHTML = '';

  for (let seat = 1; seat <= data.totalSeats; seat += 1) {
    const button = document.createElement('button');
    button.className = 'seat';
    button.textContent = seat;
    button.type = 'button';

    if (data.bookedSeats.includes(seat)) {
      button.classList.add('busy');
      button.disabled = true;
    }

    button.addEventListener('click', () => {
      if (!selectedSession) return;

      if (selectedSeats.has(seat)) {
        selectedSeats.delete(seat);
        button.classList.remove('selected');
      } else {
        selectedSeats.add(seat);
        button.classList.add('selected');
      }

      const current = Array.from(selectedSeats).sort((a, b) => a - b);
      setStatus(current.length ? `Выбраны места: ${current.join(', ')}` : 'Выбери места');
    });

    seatsEl.appendChild(button);
  }
}

tabLoginEl.addEventListener('click', () => switchTab('login'));
tabRegisterEl.addEventListener('click', () => switchTab('register'));

registerFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    fullName: registerFullnameEl.value.trim(),
    username: registerUsernameEl.value.trim(),
    password: registerPasswordEl.value,
  };

  const { response, data } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    setAuthStatus(data.error || 'Ошибка регистрации', 'error');
    return;
  }

  setAuthStatus('Регистрация успешна. Теперь войди в аккаунт.', 'success');
  registerFormEl.reset();
  switchTab('login');
});

loginFormEl.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    username: loginUsernameEl.value.trim(),
    password: loginPasswordEl.value,
  };

  const { response, data } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    setAuthStatus(data.error || 'Ошибка входа', 'error');
    return;
  }

  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem('cinema_token', authToken);
  loginFormEl.reset();
  setAuthStatus('Вход выполнен', 'success');
  updateUserUI();
});

logoutBtnEl.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  authToken = null;
  currentUser = null;
  localStorage.removeItem('cinema_token');
  setAuthStatus('Ты вышел из аккаунта', '');
  updateUserUI();
});

formEl.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setStatus('Сначала войди в аккаунт', 'error');
    return;
  }

  if (!selectedSession) {
    setStatus('Сначала выбери сеанс', 'error');
    return;
  }

  const seats = Array.from(selectedSeats).sort((a, b) => a - b);

  if (!seats.length) {
    setStatus('Выбери хотя бы одно место', 'error');
    return;
  }

  const { response, data } = await api('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: selectedSession, seats }),
  });

  if (!response.ok) {
    setStatus(data.error || 'Ошибка бронирования', 'error');
    return;
  }

  setStatus(`Бронь #${data.id} создана для ${currentUser.fullName}`, 'success');
  await selectSession(selectedSession, selectedSessionTitleEl.textContent.replace('Сеанс: ', ''));
});

(async () => {
  await loadCurrentUser();
  await loadMovies();
})().catch(() => {
  setStatus('Не удалось загрузить данные', 'error');
});
