/* ═══════════════════════════════════════════════════════
   SD HAPPY HOUR — APP.JS
   Features: filtering, map, modals, reviews, SMS share
   ═══════════════════════════════════════════════════════ */

const state = {
  view: 'list',
  filtersOpen: false,
  filters: { day: null, area: null, type: null, search: '' },
  activeVenueId: null,
  map: null,
  markers: {},
  filtered: [],
  reviews: {}
};

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TODAY = DAYS[new Date().getDay()];
const AREAS = [...new Set(VENUES.map(v => v.neighborhood))].sort();
const TYPES = ['Bar','Brewery','Seafood','Mexican','Italian','Asian','BBQ','Wine Bar','Steakhouse','Beach Bar','Hotel Bar'];

document.addEventListener('DOMContentLoaded', () => {
  loadReviews();
  buildFilterPills();
  applyFilters();
  initMap();
});

// ── REVIEWS ───────────────────────────────────────────────
function loadReviews() {
  try {
    const saved = localStorage.getItem('sdhh_reviews');
    if (saved) state.reviews = JSON.parse(saved);
  } catch(e) { state.reviews = {}; }
}

function saveReviews() {
  try { localStorage.setItem('sdhh_reviews', JSON.stringify(state.reviews)); } catch(e) {}
}

function getReviews(id)      { return state.reviews[id] || []; }
function addReview(id, rev)  { if (!state.reviews[id]) state.reviews[id] = []; state.reviews[id].unshift(rev); saveReviews(); }
function avgRating(id)       { const r = getReviews(id); return r.length ? r.reduce((s,x) => s+x.rating, 0)/r.length : 0; }

function starHTML(rating, max=5, size=14) {
  return Array.from({length:max}, (_,i) =>
    `<span style="font-size:${size}px;color:${i<Math.round(rating)?'var(--gold)':'rgba(255,180,200,0.2)'}" aria-hidden="true">★</span>`
  ).join('');
}

// ── FILTERS ───────────────────────────────────────────────
function buildFilterPills() {
  DAYS.forEach(d => {
    const btn = makePill(d + (d===TODAY?' ★':''), () => setFilter('day', d, btn));
    document.getElementById('dayFilters').appendChild(btn);
  });
  AREAS.forEach(a => {
    const btn = makePill(a, () => setFilter('area', a, btn));
    document.getElementById('areaFilters').appendChild(btn);
  });
  TYPES.forEach(t => {
    const btn = makePill(t, () => setFilter('type', t, btn));
    document.getElementById('typeFilters').appendChild(btn);
  });
}

function makePill(label, onclick) {
  const btn = document.createElement('button');
  btn.className = 'pill'; btn.textContent = label; btn.onclick = onclick;
  return btn;
}

function setFilter(key, val, btn) {
  if (state.filters[key] === val) {
    state.filters[key] = null; btn.classList.remove('active');
  } else {
    btn.parentElement.querySelectorAll('.pill.active').forEach(b => b.classList.remove('active'));
    state.filters[key] = val; btn.classList.add('active');
  }
  applyFilters(); updateChips(); updateFilterDot();
}

function updateChips() {
  const row = document.getElementById('chipsRow');
  row.innerHTML = '';
  const {day,area,type,search} = state.filters;
  if (day)    addChip(row, `Day: ${day}`,   () => clearFilter('day'));
  if (area)   addChip(row, `Area: ${area}`, () => clearFilter('area'));
  if (type)   addChip(row, `Type: ${type}`, () => clearFilter('type'));
  if (search) addChip(row, `"${search}"`, () => {
    state.filters.search = '';
    document.getElementById('searchBox').value = '';
    applyFilters(); updateChips(); updateFilterDot();
  });
}

function addChip(row, label, onClear) {
  const c = document.createElement('div');
  c.className = 'chip';
  c.innerHTML = `${label} <span class="chip-x">✕</span>`;
  c.onclick = onClear;
  row.appendChild(c);
}

function clearFilter(key) {
  state.filters[key] = null;
  const panels = {day:'dayFilters',area:'areaFilters',type:'typeFilters'};
  document.querySelectorAll(`#${panels[key]} .pill.active`).forEach(b => b.classList.remove('active'));
  applyFilters(); updateChips(); updateFilterDot();
}

function updateFilterDot() {
  const has = state.filters.day||state.filters.area||state.filters.type;
  document.getElementById('filterDot').classList.toggle('show', !!has);
  document.getElementById('filterToggle').classList.toggle('active', !!has);
}

function applyFilters() {
  const search = (document.getElementById('searchBox').value||'').toLowerCase().trim();
  state.filters.search = search;
  state.filtered = VENUES.filter(v => {
    const {day,area,type} = state.filters;
    if (day  && !v.days.includes(day))    return false;
    if (area && v.neighborhood !== area)  return false;
    if (type) {
      const t = type.toLowerCase();
      if (!v.cuisine.toLowerCase().includes(t) && !v.deals.some(d=>d.toLowerCase().includes(t))) return false;
    }
    if (search) {
      const hay = [v.name,v.neighborhood,v.cuisine,v.address,...v.deals].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
  renderCards();
  if (state.view==='map') updateMapMarkers();
  document.getElementById('resultsCount').textContent = `${state.filtered.length} of ${VENUES.length} venues`;
}

// ── CARDS ─────────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  if (!state.filtered.length) {
    grid.innerHTML = `<div class="no-results"><span class="emoji">🥂</span>No venues match — try adjusting your filters!</div>`;
    return;
  }
  grid.innerHTML = state.filtered.map(cardHTML).join('');
}

function cardHTML(v) {
  const isToday = v.days.includes(TODAY);
  const avg     = avgRating(v.id);
  const rcount  = getReviews(v.id).length;
  return `
  <div class="card" onclick="openModal(${v.id})" role="button" tabindex="0">
    <div class="card-head">
      <div class="card-name">${v.name}</div>
      <div class="card-badge${isToday?'':' wn'}">${isToday?'Open Today':'Weekday'}</div>
    </div>
    <div class="card-hood">${v.neighborhood} · ${v.zip}</div>
    <div class="card-when">${v.hours}</div>
    <ul class="deals">
      ${v.deals.slice(0,3).map(d=>`<li>${d}</li>`).join('')}
      ${v.deals.length>3?`<li class="deals-more">+${v.deals.length-3} more…</li>`:''}
    </ul>
    <div class="card-foot">
      <span class="card-cuisine">${v.cuisine}</span>
      <div class="card-stars">
        ${starHTML(avg,5,13)}
        <span class="card-rcount">${rcount?`(${rcount})`:'No reviews'}</span>
      </div>
    </div>
  </div>`;
}

// ── MODAL ─────────────────────────────────────────────────
function openModal(id) {
  const v = VENUES.find(x=>x.id===id);
  if (!v) return;
  state.activeVenueId = id;
  renderModal(v);
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderModal(v) {
  const reviews = getReviews(v.id);
  const avg     = avgRating(v.id);
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-name">${v.name}</div>
    <div class="modal-hood">${v.neighborhood}</div>
    <div class="modal-addr">📍 ${v.address}</div>
    <div class="modal-divider"></div>
    <div class="modal-label">Happy Hour</div>
    <div class="modal-when-text">🌸 ${v.hours}</div>
    <div class="modal-label">Days</div>
    <div class="modal-days">${DAYS.map(d=>
      `<span class="day-pill${!v.days.includes(d)?' dim':d===TODAY?' today':''}">${d}</span>`
    ).join('')}</div>
    <div class="modal-divider"></div>
    <div class="modal-label">Deals &amp; Specials</div>
    <ul class="modal-deals">${v.deals.map(d=>`<li>${d}</li>`).join('')}</ul>
    <div class="modal-cuisine">🍽 ${v.cuisine}</div>
    <div class="modal-divider"></div>
    <div class="modal-actions">
      ${v.url&&v.url!=='#'
        ?`<a class="btn-primary" href="${v.url}" target="_blank" rel="noopener">Website ↗</a>`
        :`<button class="btn-primary" disabled style="opacity:.35;cursor:default">No Website</button>`}
      <button class="btn-map"   onclick="goToMapVenue(${v.id})">🗺 Map</button>
      <button class="btn-share" onclick="shareVenue(${v.id})">💬 Share</button>
    </div>
    <div class="modal-divider"></div>
    <div class="modal-label">Community Reviews
      ${avg?`<span style="margin-left:6px">${starHTML(avg,5,12)}</span>
             <span class="review-summary-text">${avg.toFixed(1)} · ${reviews.length} review${reviews.length!==1?'s':''}</span>`:''}
    </div>
    <div class="review-form">
      <div class="star-picker" id="sp-${v.id}" data-val="0">
        ${[1,2,3,4,5].map(n=>`<button class="sp" data-n="${n}" onclick="pickStar(${v.id},${n})" aria-label="${n} stars">★</button>`).join('')}
      </div>
      <input  class="review-name-input" id="rname-${v.id}" type="text" placeholder="Your name (optional)" autocomplete="name">
      <textarea class="review-textarea" id="rtext-${v.id}" placeholder="How was the happy hour? Spill the tea ✨" rows="3"></textarea>
      <button class="review-submit" onclick="submitReview(${v.id})">Post Review ✦</button>
    </div>
    <div class="reviews-list" id="rlist-${v.id}">${renderReviewsList(reviews)}</div>
  `;
}

function renderReviewsList(reviews) {
  if (!reviews.length) return `<div class="no-reviews">No reviews yet — be the first! 🌸</div>`;
  return reviews.map(r=>`
    <div class="review-item">
      <div class="review-item-head">
        <span class="review-author">${r.name||'Anonymous'}</span>
        <span class="review-stars">${starHTML(r.rating,5,12)}</span>
        <span class="review-date">${r.date}</span>
      </div>
      ${r.text?`<div class="review-text">${escHtml(r.text)}</div>`:''}
    </div>`).join('');
}

function pickStar(venueId, n) {
  const picker = document.getElementById(`sp-${venueId}`);
  picker.dataset.val = n;
  picker.querySelectorAll('.sp').forEach((btn,i) => btn.classList.toggle('lit', i<n));
}

function submitReview(venueId) {
  const picker = document.getElementById(`sp-${venueId}`);
  const rating = parseInt(picker.dataset.val||'0');
  if (!rating) { showToast('Pick a star rating first ⭐'); return; }

  const review = {
    name:   document.getElementById(`rname-${venueId}`).value.trim() || 'Anonymous',
    rating,
    text:   document.getElementById(`rtext-${venueId}`).value.trim(),
    date:   new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
  };

  addReview(venueId, review);

  // reset form
  picker.dataset.val = '0';
  picker.querySelectorAll('.sp').forEach(b=>b.classList.remove('lit'));
  document.getElementById(`rname-${venueId}`).value = '';
  document.getElementById(`rtext-${venueId}`).value = '';

  document.getElementById(`rlist-${venueId}`).innerHTML = renderReviewsList(getReviews(venueId));

  // update the summary line without closing modal
  const v = VENUES.find(x=>x.id===venueId);
  if (v) {
    const avg = avgRating(venueId);
    const reviews = getReviews(venueId);
    const label = document.querySelector(`#modalContent .modal-label:last-of-type`);
    if (label) label.innerHTML = `Community Reviews
      <span style="margin-left:6px">${starHTML(avg,5,12)}</span>
      <span class="review-summary-text">${avg.toFixed(1)} · ${reviews.length} review${reviews.length!==1?'s':''}</span>`;
  }

  showToast('Review posted! 🌸');
  renderCards();
}

// ── SHARE via SMS ─────────────────────────────────────────
function shareVenue(id) {
  const v = VENUES.find(x=>x.id===id);
  if (!v) return;
  const topDeals = v.deals.slice(0,2).join(' · ');
  const msg = `🌸 Happy Hour Alert!\n\n${v.name}\n📍 ${v.neighborhood} — ${v.address}\n🕐 ${v.hours}\n✨ ${topDeals}\n\nSD Happy Hour Guide 🥂`;

  if (navigator.share) {
    navigator.share({ title: `Happy Hour at ${v.name}`, text: msg }).catch(()=>{});
  } else {
    window.open(`sms:?body=${encodeURIComponent(msg)}`, '_blank');
  }
}

function closeModal(e) {
  if (e && e.target!==document.getElementById('modalOverlay') &&
      !e.currentTarget?.classList?.contains('modal-close')) return;
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function goToMapVenue(id) {
  closeModal();
  if (state.view!=='map') toggleView();
  setTimeout(()=>flyToVenue(id), 350);
}

// ── VIEW / FILTER TOGGLES ─────────────────────────────────
function toggleView() {
  const isMap = state.view==='map';
  state.view = isMap?'list':'map';
  document.getElementById('listView').classList.toggle('active', state.view==='list');
  document.getElementById('mapView').classList.toggle('active',  state.view==='map');
  document.getElementById('viewIcon').textContent = state.view==='map'?'☰':'🗺';
  document.getElementById('viewToggle').classList.toggle('map-active', state.view==='map');
  if (state.view==='map') setTimeout(()=>{ state.map.invalidateSize(); updateMapMarkers(); buildMapSidebar(); }, 100);
}

function toggleFilters() {
  state.filtersOpen = !state.filtersOpen;
  document.getElementById('filterPanel').classList.toggle('open', state.filtersOpen);
  document.getElementById('filterToggle').classList.toggle('active', state.filtersOpen);
}

// ── MAP ───────────────────────────────────────────────────
function initMap() {
  const map = L.map('map', { center:[32.82,-117.18], zoom:11 });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:'© OpenStreetMap © CARTO', subdomains:'abcd', maxZoom:19
  }).addTo(map);
  state.map = map;
}

function updateMapMarkers() {
  Object.values(state.markers).forEach(m=>m.remove());
  state.markers = {};
  state.filtered.forEach(v=>{
    const color = v.days.includes(TODAY)?'#E8547A':'#9B7BAA';
    const icon = L.divIcon({
      className:'',
      html:`<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2.5px solid rgba(255,255,255,0.85);box-shadow:0 3px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px;line-height:1">🍹</span></div>`,
      iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-30]
    });
    const marker = L.marker([v.lat,v.lng],{icon})
      .addTo(state.map)
      .bindPopup(popupHTML(v),{maxWidth:260});
    marker.on('click',()=>highlightMapCard(v.id));
    state.markers[v.id] = marker;
  });
}

function popupHTML(v) {
  return `<div class="popup-body">
    <div class="popup-name">${v.name}</div>
    <div class="popup-hood">${v.neighborhood}</div>
    <div class="popup-when">🌸 ${v.hours}</div>
    ${v.deals.slice(0,2).map(d=>`<div class="popup-deal">${d}</div>`).join('')}
    <div class="popup-actions">
      <button class="popup-btn"   onclick="openModal(${v.id})">Details →</button>
      <button class="popup-share" onclick="shareVenue(${v.id})">💬 Share</button>
    </div>
  </div>`;
}

function flyToVenue(id) {
  const v = VENUES.find(x=>x.id===id);
  if (!v||!state.map) return;
  state.map.flyTo([v.lat,v.lng],15,{animate:true,duration:0.8});
  if (state.markers[id]) setTimeout(()=>state.markers[id].openPopup(),900);
  highlightMapCard(id);
}

function highlightMapCard(id) {
  document.querySelectorAll('.map-card').forEach(c=>c.classList.toggle('highlighted',c.dataset.id==id));
  const c = document.querySelector(`.map-card[data-id="${id}"]`);
  if (c) c.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function buildMapSidebar() {
  document.getElementById('mapCards').innerHTML = state.filtered.map(v=>`
    <div class="map-card" data-id="${v.id}" onclick="flyToVenue(${v.id})">
      <div class="map-card-name">${v.name}</div>
      <div class="map-card-hood">${v.neighborhood}</div>
      <div class="map-card-when">${v.hours}</div>
    </div>`).join('');
}

// ── UTILS ─────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2800);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
