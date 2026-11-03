import { TOOLS, CATEGORIES } from '../data/tools.js';
import { esc, safeUrl, pageHeader } from '../ui.js';

const FAV_KEY = 'osint-engine.favs.v1';

function loadFavs() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveFavs(s) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export function render(root, params) {
  const favs = loadFavs();
  let cat = params.get('cat') || 'All';
  root.innerHTML = `
    ${pageHeader(`Tool Directory`, `${TOOLS.length} curated resources across ${CATEGORIES.length} categories. ★ to pin favourites (saved in this browser).`, 'book')}
    <div class="search-row"><input id="tq" class="input" placeholder="Search tools… (e.g. subdomain, satellite, breach)" value="${esc(params.get('q') || '')}" /></div>
    <div class="chips" id="cats">${['All', '★ Favourites', ...CATEGORIES].map((c) => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <p class="muted small" id="count"></p>
    <div class="tool-grid" id="tlist"></div>`;

  const draw = () => {
    const q = root.querySelector('#tq').value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const list = TOOLS.filter((t) => {
      if (cat === '★ Favourites' && !favs.has(t.url)) return false;
      if (cat !== 'All' && cat !== '★ Favourites' && t.cat !== cat) return false;
      const hay = `${t.name} ${t.desc} ${t.cat} ${t.url}`.toLowerCase();
      return terms.every((w) => hay.includes(w));
    });
    root.querySelectorAll('#cats .chip').forEach((b) => b.classList.toggle('active', b.dataset.cat === cat));
    root.querySelector('#count').textContent = `${list.length} result(s)`;
    root.querySelector('#tlist').innerHTML =
      list
        .map(
          (t) => `<div class="tool">
            <div class="tool-h"><a href="${esc(safeUrl(t.url))}" target="_blank" rel="noopener noreferrer"><strong>${esc(t.name)}</strong> ↗</a>
              <button class="icon-btn fav ${favs.has(t.url) ? 'on' : ''}" data-fav="${esc(t.url)}" title="Favourite">${favs.has(t.url) ? '★' : '☆'}</button></div>
            <p>${esc(t.desc)}</p>
            <div class="tool-f"><span class="pill">${esc(t.cat)}</span>${t.tags.includes('cli') ? '<span class="pill">CLI / self-host</span>' : ''}${t.tags.includes('acct') ? '<span class="pill warn">Account</span>' : ''}</div>
          </div>`,
        )
        .join('') || '<p class="muted">No tools match.</p>';
  };
  root.querySelector('#tq').addEventListener('input', draw);
  root.querySelector('#cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (b) {
      cat = b.dataset.cat;
      draw();
    }
  });
  root.querySelector('#tlist').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fav]');
    if (!b) return;
    const u = b.dataset.fav;
    favs.has(u) ? favs.delete(u) : favs.add(u);
    saveFavs(favs);
    draw();
  });
  draw();
}
