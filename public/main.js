async function initHomePage() {
  Cinema.setActiveNav();
  const user = await Cinema.getCurrentUser();
  Cinema.renderUserBar(user);

  const preview = document.getElementById('movie-preview');
  const { response, data } = await Cinema.api('/api/movies');

  if (!response.ok) {
    preview.innerHTML = '<p class="muted">Не удалось загрузить фильмы.</p>';
    return;
  }

  preview.innerHTML = data
    .map((movie) => {
      const count = movie.sessions.length;
      return `
        <article class="movie-card">
          <h3>${movie.title}</h3>
          <p>${movie.description}</p>
          <p class="muted">${movie.durationMin} мин | ${movie.ageRating}</p>
          <p><strong>Сеансов:</strong> ${count}</p>
        </article>
      `;
    })
    .join('');
}

initHomePage();
