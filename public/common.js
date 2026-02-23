(function initCinemaCommon() {
  const STORAGE_KEY = 'cinema_token';

  function getToken() {
    return localStorage.getItem(STORAGE_KEY);
  }

  function setToken(token) {
    if (!token) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  async function getCurrentUser() {
    const token = getToken();
    if (!token) return null;
    const { response, data } = await api('/api/auth/me');
    if (!response.ok) {
      clearToken();
      return null;
    }
    return data.user;
  }

  function formatDate(value) {
    return new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    clearToken();
  }

  function setActiveNav() {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === page);
    });
  }

  function renderUserBar(user) {
    const userBar = document.getElementById('user-bar');
    if (!userBar) return;

    if (!user) {
      userBar.innerHTML = '<a class="btn ghost" href="/auth.html">Войти</a>';
      return;
    }

    userBar.innerHTML = `
      <span class="user-chip">${user.fullName}</span>
      <button id="logout-btn" class="btn danger" type="button">Выйти</button>
    `;

    const btn = document.getElementById('logout-btn');
    btn.addEventListener('click', async () => {
      await logout();
      location.href = '/auth.html';
    });
  }

  window.Cinema = {
    api,
    getToken,
    setToken,
    clearToken,
    getCurrentUser,
    formatDate,
    logout,
    setActiveNav,
    renderUserBar,
  };
})();
