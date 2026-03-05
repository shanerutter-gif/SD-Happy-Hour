/* ═══════════════════════════════════════════════════════
   SD HAPPY HOUR — APP.JS
   Handles: filtering, rendering cards, Leaflet map,
            modals, AI concierge, view toggling
   ═══════════════════════════════════════════════════════ */

// ── STATE ────────────────────────────────────────────────
const state = {
  view: 'list',       // 'list' | 'map'
  filtersOpen: false,
  filters: {
    day: null,
    area: null,
    type: null,
    search: ''
  },
  activeVenueId: null,
  map: null,
  markers: {},
  filtered: []
};

// Day labels
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TODAY = DAYS[new Date().getDay()];

// Collect unique neighborhoods for area filter
const AREAS = [...new Set(VENUES.map(v => v.neighborhood))].sort();
const TYPES = ['Bar','Brewery','Seafood','Mexican','Italian','Asian','BBQ','Wine Bar','Steakhouse','Beach Bar','Hotel Bar'];

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildFilterPills();
  applyFilters();
  initMap();

  // AI enter key
  document.getElementById('aiQuery').addEventListener('keydown', e => {
    if (e.key === 'Enter') askAI();
  });
});

// ── FILTER PILLS ─────────────────────────────────────────
function buildFilterPills() {
  // Day filter
  const dayEl = document.getElementById('dayFilters');
  DAYS.forEach(d => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (d === TODAY ? ' today-opt' : '');
    btn.textContent = d + (d === TODAY ? ' ★' : '');
    btn.dataset.val = d;
    btn.onclick = () => setFilter('day', d, btn);
    dayEl.appendChild(btn);
  });

  // Area filter
  const areaEl = document.getElementById('areaFilters');
  AREAS.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.textContent = a;
    btn.dataset.val = a;
    btn.onclick = () => setFilter('area', a, btn);
    areaEl.appendChild(btn);
  });

  // Type filter (cuisine keyword match)
  const typeEl = document.getElementById('typeFilters');
  TYPES.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.textContent = t;
    btn.dataset.val = t;
    btn.onclick = () => setFilter('type', t, btn);
    typeEl.appendChild(btn);
  });
}

function setFilter(key, val, btn) {
  if (state.filters[key] === val) {
    state.filters[key] = null;
    btn.classList.remove('active');
  } else {
    // deactivate siblings
    const parent = btn.parentElement;
    parent.querySelectorAll('.pill.active').forEach(b => b.classList.remove('active'));
    state.filters[key] = val;
    btn.classList.add('active');
  }
  applyFilters();
  updateChips();
  updateFilterDot();
}

function updateChips() {
  const row = document.getElementById('chipsRow');
  row.innerHTML = '';
  const { day, area, type, search } = state.filters;
  if (day) addChip(row, `Day: ${day}`, () => clearFilter('day'));
  if (area) addChip(row, `Area: ${area}`, () => clearFilter('area'));
  if (type) addChip(row, `Type: ${type}`, () => clearFilter('type'));
  if (search) addChip(row, `"${search}"`, () => { state.filters.search = ''; document.getElementById('searchBox').value = ''; applyFilters(); updateChips(); updateFilterDot(); });
}

function addChip(row, label, onClear) {
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.innerHTML = `${label} <span class="chip-x">✕</span>`;
  chip.onclick = onClear;
  row.appendChild(chip);
}

function clearFilter(key) {
  state.filters[key] = null;
  // deactivate pill
  const panels = { day: 'dayFilters', area: 'areaFilters', type: 'typeFilters' };
  document.querySelectorAll(`#${panels[key]} .pill.active`).forEach(b => b.classList.remove('active'));
  applyFilters();
  updateChips();
  updateFilterDot();
}

function updateFilterDot() {
  const { day, area, type } = state.filters;
  const hasFilter = day || area || type;
  document.getElementById('filterDot').classList.toggle('show', !!hasFilter);
  document.getElementById('filterToggle').classList.toggle('active', !!hasFilter);
}

// ── FILTERING ────────────────────────────────────────────
function applyFilters() {
  const search = (document.getElementById('searchBox').value || '').toLowerCase().trim();
  state.filters.search = search;

  state.filtered = VENUES.filter(v => {
    const { day, area, type } = state.filters;

    if (day && !v.days.includes(day)) return false;
    if (area && v.neighborhood !== area) return false;
    if (type) {
      const t = type.toLowerCase();
      const cuisineMatch = v.cuisine.toLowerCase().includes(t);
      const dealMatch = v.deals.some(d => d.toLowerCase().includes(t));
      if (!cuisineMatch && !dealMatch) return false;
    }
    if (search) {
      const hay = [v.name, v.neighborhood, v.cuisine, v.address, ...v.deals].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  renderCards();
  if (state.view === 'map') updateMapMarkers();
  document.getElementById('resultsCount').textContent =
    `${state.filtered.length} of ${VENUES.length} venues`;
}

// ── CARD RENDERING ────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  if (state.filtered.length === 0) {
    grid.innerHTML = `<div class="no-results"><span class="emoji">🥂</span>No venues match your filters.<br>Try adjusting your search!</div>`;
    return;
  }
  grid.innerHTML = state.filtered.map(v => cardHTML(v)).join('');
}

function cardHTML(v) {
  const isToday = v.days.includes(TODAY);
  return `
  <div class="card" onclick="openModal(${v.id})" role="button" tabindex="0" aria-label="${v.name}">
    <div class="card-head">
      <div class="card-name">${v.name}</div>
      <div class="card-badge${isToday ? '' : ' wn'}">${isToday ? 'Open Today' : 'Weekday'}</div>
    </div>
    <div class="card-hood">${v.neighborhood} · ${v.zip}</div>
    <div class="card-when">${v.hours}</div>
    <ul class="deals">
      ${v.deals.slice(0,3).map(d => `<li>${d}</li>`).join('')}
      ${v.deals.length > 3 ? `<li style="opacity:.5">+${v.deals.length-3} more deals…</li>` : ''}
    </ul>
    <div class="card-foot">
      <span class="card-cuisine">${v.cuisine}</span>
      <span class="card-action">Details →</span>
    </div>
  </div>`;
}

// ── MODAL ─────────────────────────────────────────────────
function openModal(id) {
  const v = VENUES.find(x => x.id === id);
  if (!v) return;
  state.activeVenueId = id;

  const content = document.getElementById('modalContent');
  content.innerHTML = `
    <div class="modal-name">${v.name}</div>
    <div class="modal-hood">${v.neighborhood}</div>
    <div class="modal-addr">📍 ${v.address}</div>
    <div class="modal-divider"></div>
    <div class="modal-label">Happy Hour</div>
    <div class="modal-when-text">🌸 ${v.hours}</div>
    <div class="modal-label">Days Open</div>
    <div class="modal-days">${DAYS.map(d =>
      `<span class="day-pill${v.days.includes(d) ? (d===TODAY?' today':'') : ''}" style="${v.days.includes(d)?'':'opacity:.25'}">${d}</span>`
    ).join('')}</div>
    <div class="modal-divider"></div>
    <div class="modal-label">Deals &amp; Specials</div>
    <ul class="modal-deals">${v.deals.map(d=>`<li>${d}</li>`).join('')}</ul>
    <div class="modal-label" style="margin-top:12px">Cuisine</div>
    <div style="font-size:14px;color:rgba(255,220,230,.7);margin-bottom:4px">${v.cuisine}</div>
    ${v.url && v.url !== '#' ? `<a class="modal-link-btn" href="${v.url}" target="_blank" rel="noopener">Visit Website ↗</a>` : `<button class="modal-link-btn" disabled style="opacity:.4;cursor:default">Website Coming Soon</button>`}
    <button class="modal-map-btn" onclick="goToMapVenue(${v.id})">🗺 Show on Map</button>
  `;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay') && !e.currentTarget.classList.contains('modal-close')) return;
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function goToMapVenue(id) {
  closeModal();
  if (state.view !== 'map') toggleView();
  setTimeout(() => flyToVenue(id), 350);
}

// ── VIEW TOGGLE ───────────────────────────────────────────
function toggleView() {
  const isMap = state.view === 'map';
  state.view = isMap ? 'list' : 'map';

  document.getElementById('listView').classList.toggle('active', state.view === 'list');
  document.getElementById('mapView').classList.toggle('active', state.view === 'map');

  const icon = document.getElementById('viewIcon');
  icon.textContent = state.view === 'map' ? '☰' : '🗺';
  document.getElementById('viewToggle').classList.toggle('map-active', state.view === 'map');

  if (state.view === 'map') {
    // force leaflet to recalculate size
    setTimeout(() => {
      state.map.invalidateSize();
      updateMapMarkers();
      buildMapSidebar();
    }, 100);
  }
}

// ── FILTER PANEL TOGGLE ───────────────────────────────────
function toggleFilters() {
  state.filtersOpen = !state.filtersOpen;
  document.getElementById('filterPanel').classList.toggle('open', state.filtersOpen);
  document.getElementById('filterToggle').classList.toggle('active', state.filtersOpen);
}

// ── LEAFLET MAP ───────────────────────────────────────────
function initMap() {
  const map = L.map('map', {
    center: [32.82, -117.18],
    zoom: 11,
    zoomControl: true,
    attributionControl: true
  });

  // Dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  state.map = map;
}

function updateMapMarkers() {
  // remove all existing markers
  Object.values(state.markers).forEach(m => m.remove());
  state.markers = {};

  state.filtered.forEach(v => {
    const isToday = v.days.includes(TODAY);
    const color = isToday ? '#E8547A' : '#9B7BAA';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:28px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};
        border:2.5px solid rgba(255,255,255,0.85);
        box-shadow:0 3px 10px rgba(0,0,0,0.45);
        display:flex;align-items:center;justify-content:center;
        cursor:pointer;
      "><span style="transform:rotate(45deg);font-size:12px;line-height:1">🍹</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -30]
    });

    const marker = L.marker([v.lat, v.lng], { icon })
      .addTo(state.map)
      .bindPopup(popupHTML(v), { maxWidth: 260, className: 'custom-popup' });

    marker.on('click', () => {
      highlightMapCard(v.id);
    });

    state.markers[v.id] = marker;
  });
}

function popupHTML(v) {
  return `
  <div class="popup-body">
    <div class="popup-name">${v.name}</div>
    <div class="popup-hood">${v.neighborhood}</div>
    <div class="popup-when">🌸 ${v.hours}</div>
    ${v.deals.slice(0,2).map(d => `<div class="popup-deal">${d}</div>`).join('')}
    <button class="popup-btn" onclick="openModal(${v.id})">Full Details →</button>
  </div>`;
}

function flyToVenue(id) {
  const v = VENUES.find(x => x.id === id);
  if (!v || !state.map) return;
  state.map.flyTo([v.lat, v.lng], 15, { animate: true, duration: 0.8 });
  const marker = state.markers[id];
  if (marker) setTimeout(() => marker.openPopup(), 900);
  highlightMapCard(id);
}

function highlightMapCard(id) {
  document.querySelectorAll('.map-card').forEach(c => {
    c.classList.toggle('highlighted', c.dataset.id == id);
  });
  const card = document.querySelector(`.map-card[data-id="${id}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function buildMapSidebar() {
  const container = document.getElementById('mapCards');
  container.innerHTML = state.filtered.map(v => `
    <div class="map-card" data-id="${v.id}" onclick="flyToVenue(${v.id})">
      <div class="map-card-name">${v.name}</div>
      <div class="map-card-hood">${v.neighborhood}</div>
      <div class="map-card-when">${v.hours}</div>
    </div>
  `).join('');
}

// ── AI CONCIERGE ──────────────────────────────────────────
async function askAI() {
  const input = document.getElementById('aiQuery');
  const btn = document.getElementById('aiBtn');
  const resp = document.getElementById('aiResponse');
  const query = input.value.trim();
  if (!query) return;

  btn.disabled = true;
  resp.className = 'ai-response visible';
  resp.innerHTML = `<div class="ai-thinking">✦ Thinking <div class="dots"><span></span><span></span><span></span></div></div>`;

  // Build context from venue list
  const venueContext = VENUES.map(v =>
    `${v.name} (${v.neighborhood}): ${v.hours} on ${v.days.join(',')} — ${v.deals.slice(0,3).join('; ')}`
  ).join('\n');

  const systemPrompt = `You are a fun, knowledgeable San Diego happy hour guide assistant with a bubbly, friendly personality. You help people find the best happy hour deals in San Diego County.

Here is your current database of venues:
${venueContext}

Answer the user's question based on this data. Be specific, mention venue names, hours, and deals. Keep your answer concise (2-4 sentences or a short bulleted list). Use a friendly, conversational tone. Add a relevant emoji or two.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }]
      })
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || 'Sorry, I couldn\'t find an answer. Try rephrasing!';
    resp.innerHTML = text.replace(/\n/g, '<br>');
  } catch (err) {
    resp.innerHTML = '✦ Could not connect to AI. Try checking your API key in the settings, or ask again shortly!';
  } finally {
    btn.disabled = false;
  }
}

// ── UTILS ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
