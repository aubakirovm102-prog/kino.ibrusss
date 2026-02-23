const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authStatus = document.getElementById('auth-status');

function setAuthStatus(text, type = '') {
  authStatus.textContent = text;
  authStatus.className = `status ${type}`.trim();
}

function switchTo(mode) {
  const loginMode = mode === 'login';
  tabLogin.classList.toggle('active', loginMode);
  tabRegister.classList.toggle('active', !loginMode);
  loginForm.classList.toggle('hidden', !loginMode);
  registerForm.classList.toggle('hidden', loginMode);
  setAuthStatus('');
}

async function initAuthPage() {
  Cinema.setActiveNav();
  const user = await Cinema.getCurrentUser();
  Cinema.renderUserBar(user);

  if (user) {
    setAuthStatus(`Вы уже вошли как ${user.fullName}. Можно перейти к афише.`, 'success');
  }
}

tabLogin.addEventListener('click', () => switchTo('login'));
tabRegister.addEventListener('click', () => switchTo('register'));

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    fullName: document.getElementById('register-fullname').value.trim(),
    username: document.getElementById('register-username').value.trim(),
    password: document.getElementById('register-password').value,
  };

  const { response, data } = await Cinema.api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    setAuthStatus(data.error || 'Ошибка регистрации', 'error');
    return;
  }

  setAuthStatus('Регистрация прошла успешно. Теперь войди в аккаунт.', 'success');
  registerForm.reset();
  switchTo('login');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    username: document.getElementById('login-username').value.trim(),
    password: document.getElementById('login-password').value,
  };

  const { response, data } = await Cinema.api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    setAuthStatus(data.error || 'Ошибка входа', 'error');
    return;
  }

  Cinema.setToken(data.token);
  setAuthStatus('Вход успешен. Переходим к афише...', 'success');
  setTimeout(() => {
    location.href = '/movies.html';
  }, 700);
});

initAuthPage();
