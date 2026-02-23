const moviesEl = document.getElementById('movies');
const seatsEl = document.getElementById('seats');
const bookingStatus = document.getElementById('booking-status');
const selectedSessionTitle = document.getElementById('selected-session-title');
const bookBtn = document.getElementById('book-btn');

let selectedSession = null;
let selectedSessionMovieTitle = '';
let selectedSeats = new Set();

function setBookingStatus(text, type = '') {
  bookingStatus.textContent = text;
  bookingStatus.className = `status ${type}`.trim();
}

async function loadMovies() {
  const { response, data } = await Cinema.api('/api/movies');
  if (!response.ok) {
    moviesEl.innerHTML = '<p class="muted">Не удалось загрузить афишу.</p>';
    return;
  }

  moviesEl.innerHTML = data
    .map((movie) => {
      const sessions = movie.sessions
        .map(
          (s) =>
            `<button class="session-btn" data-session-id="${s.id}" data-title="${movie.title}">
              ${Cinema.formatDate(s.startTime)} | ${s.hall} | ${s.price} ₽
            </button>`
        )
        .join('');

      return `
        <article class="movie-card">
          <h3>${movie.title}</h3>
          <p>${movie.description}</p>
          <p class="muted">${movie.durationMin} мин | ${movie.ageRating}</p>
          <div class="sessions">${sessions || '<span class="muted">Сеансов нет</span>'}</div>
        </article>
      `;
    })
    .join('');

  document.querySelectorAll('.session-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const sessionId = Number(button.dataset.sessionId);
      const movieTitle = button.dataset.title;
      selectSession(sessionId, movieTitle);
    });
  });
}

async function selectSession(sessionId, movieTitle) {
  selectedSession = sessionId;
  selectedSessionMovieTitle = movieTitle;
  selectedSeats = new Set();
  selectedSessionTitle.textContent = `Сеанс: ${movieTitle}`;

  const { response, data } = await Cinema.api(`/api/sessions/${sessionId}/seats`);
  if (!response.ok) {
    setBookingStatus(data.error || 'Ошибка загрузки мест', 'error');
    return;
  }

  seatsEl.innerHTML = '';

  for (let seat = 1; seat <= data.totalSeats; seat += 1) {
    const btn = document.createElement('button');
    btn.className = 'seat';
    btn.textContent = seat;

    if (data.bookedSeats.includes(seat)) {
      btn.classList.add('busy');
      btn.disabled = true;
    }

    btn.addEventListener('click', () => {
      if (selectedSeats.has(seat)) {
        selectedSeats.delete(seat);
        btn.classList.remove('selected');
      } else {
        selectedSeats.add(seat);
        btn.classList.add('selected');
      }

      const chosen = [...selectedSeats].sort((a, b) => a - b);
      setBookingStatus(
        chosen.length ? `Выбраны места: ${chosen.join(', ')}` : 'Выбери места для бронирования'
      );
    });

    seatsEl.appendChild(btn);
  }

  setBookingStatus('Выбери места для бронирования');
}

bookBtn.addEventListener('click', async () => {
  const user = await Cinema.getCurrentUser();
  if (!user) {
    setBookingStatus('Сначала войди в аккаунт', 'error');
    return;
  }

  if (!selectedSession) {
    setBookingStatus('Сначала выбери сеанс', 'error');
    return;
  }

  const seats = [...selectedSeats].sort((a, b) => a - b);
  if (!seats.length) {
    setBookingStatus('Выбери хотя бы одно место', 'error');
    return;
  }

  const { response, data } = await Cinema.api('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: selectedSession, seats }),
  });

  if (!response.ok) {
    setBookingStatus(data.error || 'Ошибка бронирования', 'error');
    return;
  }

  setBookingStatus(`Бронь #${data.id} успешно создана`, 'success');
  await selectSession(selectedSession, selectedSessionMovieTitle);
});

async function initMoviesPage() {
  Cinema.setActiveNav();
  const user = await Cinema.getCurrentUser();
  Cinema.renderUserBar(user);
  await loadMovies();
}

initMoviesPage();
