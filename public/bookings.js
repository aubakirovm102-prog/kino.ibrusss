const listEl = document.getElementById('booking-list');
const statusEl = document.getElementById('bookings-status');

function setStatus(text, type = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${type}`.trim();
}

function bookingCard(item) {
  const movieName = item.movie ? item.movie.title : 'Неизвестный фильм';
  const sessionText = item.session
    ? `${Cinema.formatDate(item.session.startTime)} | ${item.session.hall}`
    : 'Сеанс удален';

  return `
    <article class="booking-card">
      <h3>${movieName}</h3>
      <p class="muted">${sessionText}</p>
      <p><strong>Места:</strong> ${item.seats.join(', ')}</p>
      <p class="muted">Бронь: ${Cinema.formatDate(item.createdAt)}</p>
      <button class="btn danger cancel-btn" type="button" data-id="${item.id}">Отменить бронь</button>
    </article>
  `;
}

async function loadMyBookings() {
  const user = await Cinema.getCurrentUser();
  Cinema.renderUserBar(user);

  if (!user) {
    listEl.innerHTML = '<p class="muted">Нужно войти в аккаунт, чтобы видеть свои брони.</p>';
    setStatus('Требуется авторизация', 'error');
    return;
  }

  const { response, data } = await Cinema.api('/api/bookings/my');
  if (!response.ok) {
    setStatus(data.error || 'Не удалось загрузить брони', 'error');
    return;
  }

  if (!data.length) {
    listEl.innerHTML = '<p class="muted">У тебя пока нет бронирований.</p>';
    setStatus('');
    return;
  }

  listEl.innerHTML = data.map(bookingCard).join('');
  setStatus(`Найдено броней: ${data.length}`, 'success');

  document.querySelectorAll('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bookingId = Number(btn.dataset.id);
      const { response: delResp, data: delData } = await Cinema.api(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
      });

      if (!delResp.ok) {
        setStatus(delData.error || 'Не удалось отменить бронь', 'error');
        return;
      }

      setStatus(`Бронь #${bookingId} отменена`, 'success');
      await loadMyBookings();
    });
  });
}

async function initBookingsPage() {
  Cinema.setActiveNav();
  await loadMyBookings();
}

initBookingsPage();
