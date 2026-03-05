/* ═══════════════════════════════════════════════════════
   SD HAPPY HOUR — APP.JS
   Full Supabase-connected version with:
   - Reviews (DB-backed, edit/delete own)
   - Favorites (per user)
   - Auth (email/password)
   - Profile (neighborhoods, digest pref, my reviews)
   - SMS Share
   ═══════════════════════════════════════════════════════ */

// ── STATE ────────────────────────────────────────────────
const state = {
  view: 'list',
  filtersOpen: false,
  favFilterOn: false,
  filters: { day: null, area: null, type: null, search: '' },
  activeVenueId: null,
  map: null,
  markers: {},
  filtered: [],
  reviewCache: {},        // venueId → array of reviews
  reviewCacheTime: {},    // venueId → timestamp
};

const DAYS      = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TODAY     = DAYS[new Date().getDay()];
const AREAS     = [...new Set(VENUES.map(v => v.neighborhood))].sort();
const CUISINES  = ['Bar','Brewery','Seafood','Mexican','Italian','Asian','BBQ','Wine Bar','Steakhouse','Beach Bar'];
const CACHE_TTL = 60000; // 1 min review cache

// ── BOOT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  buildFilterPills();
  applyFilters();
  initMap();
  // auth state handled via supabase.js onAuthStateChange → onAuthChange()
});

// Called by supabase.js whenever auth state changes
async function onAuthChange(user) {
  renderNav(user);
  renderCards(); // refresh hearts
  if (document.getElementById('profileOverlay').classList.contains('open')) {
    if (user) renderProfileModal(user);
    else closeProfile();
  }
  // Show/hide favorites filter
  document.getElementById('favFilterGroup').style.display = user ? '' : 'none';
  if (!user && state.favFilterOn) { state.favFilterOn = false; applyFilters(); }
}

// ── TOP NAV ───────────────────────────────────────────────
function renderNav(user) {
  const right = document.getElementById('navRight');
  if (user) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    right.innerHTML = `
      <button class="nav-btn" onclick="openFavoritesView()">♥ Saved</button>
      <button class="nav-btn nav-profile" onclick="openProfile()">${name.split(' ')[0]} ✦</button>
      <button class="nav-btn nav-signout" onclick="handleSignOut()">Sign out</button>`;
  } else {
    right.innerHTML = `<button class="nav-btn nav-login" onclick="openAuth('signin')">Sign In / Join</button>`;
  }
}

async function handleSignOut() {
  await authSignOut();
  showToast('Signed out — see you soon! 🌸');
}

// ── AUTH MODAL ────────────────────────────────────────────
function openAuth(mode = 'signin') {
  renderAuthModal(mode);
  document.getElementById('authOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuth(e) {
  if (e && e.target !== document.getElementById('authOverlay')) return;
  document.getElementById('authOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderAuthModal(mode) {
  const isSignIn = mode === 'signin';
  document.getElementById('authContent').innerHTML = `
    <div class="auth-header">
      <div class="modal-name" style="font-size:22px">${isSignIn ? 'Welcome Back 🌸' : 'Join the Club 🥂'}</div>
      <p class="modal-addr">${isSignIn ? 'Sign in to save favorites & manage reviews' : 'Create an account — free forever'}</p>
    </div>
    ${!isSignIn ? `<div class="auth-field-wrap">
      <label class="auth-label">Your Name</label>
      <input class="review-name-input" id="authName" type="text" placeholder="First & last name" autocomplete="name">
    </div>` : ''}
    <div class="auth-field-wrap">
      <label class="auth-label">Email</label>
      <input class="review-name-input" id="authEmail" type="email" placeholder="you@example.com" autocomplete="email">
    </div>
    <div class="auth-field-wrap">
      <label class="auth-label">Password</label>
      <input class="review-name-input" id="authPassword" type="password"
        placeholder="${isSignIn ? 'Your password' : 'Min 8 characters'}" autocomplete="${isSignIn ? 'current-password' : 'new-password'}">
    </div>
    ${isSignIn ? `<button class="auth-forgot" onclick="handleForgotPassword()">Forgot password?</button>` : ''}
    <button class="review-submit" id="authSubmitBtn" onclick="handleAuth('${mode}')" style="margin-top:4px">
      ${isSignIn ? 'Sign In ✦' : 'Create Account ✦'}
    </button>
    <p class="auth-switch">
      ${isSignIn ? "Don't have an account?" : 'Already have an account?'}
      <button class="auth-switch-btn" onclick="renderAuthModal('${isSignIn ? 'signup' : 'signin'}')">${isSignIn ? 'Sign up free' : 'Sign in'}</button>
    </p>`;

  // Enter key support
  setTimeout(() => {
    ['authEmail','authPassword','authName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('keydown', e => { if (e.key==='Enter') handleAuth(mode); });
    });
  }, 50);
}

async function handleAuth(mode) {
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true; btn.textContent = 'Please wait…';

  const email    = (document.getElementById('authEmail')?.value || '').trim();
  const password = document.getElementById('authPassword')?.value || '';

  if (!email || !password) { showToast('Please fill in all fields'); btn.disabled=false; renderAuthModal(mode); return; }

  if (mode === 'signup') {
    const name = (document.getElementById('authName')?.value || '').trim();
    const { error } = await authSignUp(email, password, name);
    if (error) { showToast('❌ ' + error.message); btn.disabled=false; renderAuthModal(mode); return; }
    closeAuth();
    showToast('✉️ Check your email to confirm your account!');
  } else {
    const { error } = await authSignIn(email, password);
    if (error) { showToast('❌ ' + error.message); btn.disabled=false; renderAuthModal(mode); return; }
    closeAuth();
    showToast('Welcome back! 🌸');
  }
}

async function handleForgotPassword() {
  const email = (document.getElementById('authEmail')?.value || '').trim();
  if (!email) { showToast('Enter your email first'); return; }
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '?reset=true'
  });
  if (error) { showToast('❌ ' + error.message); return; }
  showToast('✉️ Password reset link sent!');
  closeAuth();
}

// ── PROFILE MODAL ─────────────────────────────────────────
async function openProfile() {
  if (!currentUser) { openAuth('signin'); return; }
  renderProfileModal(currentUser);
  document.getElementById('profileOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfile(e) {
  if (e && e.target !== document.getElementById('profileOverlay')) return;
  document.getElementById('profileOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function renderProfileModal(user) {
  const profile   = await getProfile(user.id);
  const myReviews = await fetchMyReviews(user.id);
  const favIds    = await getFavoriteVenues(user.id);
  const followed  = await getFollowedNeighborhoods(user.id);
  const favVenues = VENUES.filter(v => favIds.includes(v.id));

  document.getElementById('profileContent').innerHTML = `
    <div class="modal-name" style="font-size:20px">My Profile ✦</div>
    <div class="profile-email">${user.email}</div>

    <!-- Display name -->
    <div class="profile-section">
      <div class="profile-section-title">Display Name</div>
      <div style="display:flex;gap:8px">
        <input class="review-name-input" id="profileName" type="text"
          value="${escHtml(profile?.display_name || user.user_metadata?.full_name || '')}"
          placeholder="Your name" style="flex:1">
        <button class="btn-save-sm" onclick="saveDisplayName()">Save</button>
      </div>
    </div>

    <!-- Email digest -->
    <div class="profile-section">
      <div class="profile-section-title">Weekly Digest</div>
      <label class="toggle-label">
        <input type="checkbox" id="digestToggle" ${profile?.digest_enabled ? 'checked' : ''}
          onchange="saveDigestPref(this.checked)">
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
        <span class="toggle-text">Email me new happy hour deals weekly</span>
      </label>
    </div>

    <!-- Followed neighborhoods -->
    <div class="profile-section">
      <div class="profile-section-title">Followed Neighborhoods</div>
      <div class="profile-hoods-grid" id="hoodsGrid">
        ${AREAS.map(a => `
          <button class="hood-pill${followed.includes(a) ? ' followed' : ''}"
            onclick="toggleHood('${a}', this)">${a}</button>
        `).join('')}
      </div>
    </div>

    <!-- Saved favorites -->
    <div class="profile-section">
      <div class="profile-section-title">Saved Favorites (${favVenues.length})</div>
      ${favVenues.length ? `
        <div class="profile-fav-list">
          ${favVenues.map(v => `
            <div class="profile-fav-item" onclick="closeProfile();openModal(${v.id})">
              <div class="profile-fav-name">${v.name}</div>
              <div class="profile-fav-meta">${v.neighborhood} · ${v.hours}</div>
            </div>`).join('')}
        </div>` : `<div class="no-reviews">No favorites yet — heart a venue to save it! 🌸</div>`}
    </div>

    <!-- My reviews -->
    <div class="profile-section">
      <div class="profile-section-title">My Reviews (${myReviews.length})</div>
      ${myReviews.length ? `
        <div class="reviews-list">
          ${myReviews.map(r => {
            const v = VENUES.find(x => x.id === r.venue_id);
            return `
            <div class="review-item">
              <div class="review-venue-name" onclick="closeProfile();openModal(${r.venue_id})">${v ? v.name : 'Unknown Venue'}</div>
              <div class="review-item-head">
                <span class="review-stars">${starHTML(r.rating,5,12)}</span>
                <span class="review-date">${fmtDate(r.created_at)}</span>
              </div>
              ${r.text ? `<div class="review-text">${escHtml(r.text)}</div>` : ''}
              <div class="review-actions">
                <button class="review-act-btn" onclick="openEditReview('${r.id}', ${r.venue_id}, ${r.rating}, \`${escHtml(r.text||'')}\`)">Edit</button>
                <button class="review-act-btn review-act-delete" onclick="confirmDeleteReview('${r.id}', ${r.venue_id})">Delete</button>
              </div>
            </div>`}).join('')}
        </div>` : `<div class="no-reviews">You haven't reviewed anything yet 🌸</div>`}
    </div>
  `;
}

async function saveDisplayName() {
  const name = document.getElementById('profileName').value.trim();
  if (!name) return;
  await updateProfile(currentUser.id, { display_name: name });
  showToast('Name updated! ✦');
}

async function saveDigestPref(enabled) {
  await setDigestPreference(currentUser.id, enabled);
  showToast(enabled ? '📬 Weekly digest enabled!' : 'Digest turned off');
}

async function toggleHood(neighborhood, btn) {
  if (!currentUser) { openAuth('signin'); return; }
  const added = await toggleNeighborhoodFollow(currentUser.id, neighborhood);
  btn.classList.toggle('followed', added);
  showToast(added ? `Following ${neighborhood} ✦` : `Unfollowed ${neighborhood}`);
}

// Favorites-only view
function openFavoritesView() {
  if (!currentUser) { openAuth('signin'); return; }
  state.favFilterOn = true;
  document.getElementById('favFilterBtn').classList.add('active');
  applyFilters();
  if (state.view === 'map') toggleView();
}

function toggleFavFilter() {
  if (!currentUser) { openAuth('signin'); return; }
  state.favFilterOn = !state.favFilterOn;
  document.getElementById('favFilterBtn').classList.toggle('active', state.favFilterOn);
  applyFilters();
}

// ── EDIT REVIEW MODAL ─────────────────────────────────────
function openEditReview(reviewId, venueId, currentRating, currentText) {
  document.getElementById('editReviewContent').innerHTML = `
    <div class="modal-name" style="font-size:18px">Edit Review</div>
    <div class="review-form" style="margin-top:14px">
      <div class="star-picker" id="editPicker" data-val="${currentRating}">
        ${[1,2,3,4,5].map(n =>
          `<button class="sp${n<=currentRating?' lit':''}" onclick="pickEditStar(${n})" aria-label="${n} stars">★</button>`
        ).join('')}
      </div>
      <textarea class="review-textarea" id="editText" rows="4">${escHtml(currentText)}</textarea>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="review-submit" style="flex:1" onclick="submitEditReview('${reviewId}',${venueId})">Save Changes ✦</button>
        <button class="btn-map" onclick="closeEditReview()" style="flex:0 0 auto;padding:13px 16px">Cancel</button>
      </div>
    </div>`;
  document.getElementById('editReviewOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function pickEditStar(n) {
  const p = document.getElementById('editPicker');
  p.dataset.val = n;
  p.querySelectorAll('.sp').forEach((b,i) => b.classList.toggle('lit', i<n));
}

async function submitEditReview(reviewId, venueId) {
  const rating = parseInt(document.getElementById('editPicker').dataset.val || '0');
  const text   = document.getElementById('editText').value.trim();
  if (!rating) { showToast('Pick a rating ⭐'); return; }
  const { error } = await updateReview(reviewId, { rating, text });
  if (error) { showToast('❌ Could not save: ' + error.message); return; }
  // bust cache
  delete state.reviewCache[venueId];
  closeEditReview();
  showToast('Review updated! ✦');
  // refresh profile + venue modal if open
  if (document.getElementById('profileOverlay').classList.contains('open')) renderProfileModal(currentUser);
  if (state.activeVenueId === venueId) refreshVenueReviews(venueId);
}

function closeEditReview(e) {
  if (e && e.target !== document.getElementById('editReviewOverlay')) return;
  document.getElementById('editReviewOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function confirmDeleteReview(reviewId, venueId) {
  if (!confirm('Delete this review?')) return;
  const error = await deleteReview(reviewId);
  if (error) { showToast('❌ ' + error.message); return; }
  delete state.reviewCache[venueId];
  showToast('Review deleted');
  if (document.getElementById('profileOverlay').classList.contains('open')) renderProfileModal(currentUser);
  if (state.activeVenueId === venueId) refreshVenueReviews(venueId);
  renderCards();
}

// ── FILTERS ───────────────────────────────────────────────
function buildFilterPills() {
  DAYS.forEach(d => {
    const b = makePill(d+(d===TODAY?' ★':''), ()=>setFilter('day',d,b));
    document.getElementById('dayFilters').appendChild(b);
  });
  AREAS.forEach(a => {
    const b = makePill(a, ()=>setFilter('area',a,b));
    document.getElementById('areaFilters').appendChild(b);
  });
  CUISINES.forEach(t => {
    const b = makePill(t, ()=>setFilter('type',t,b));
    document.getElementById('typeFilters').appendChild(b);
  });
}

function makePill(label, onclick) {
  const b = document.createElement('button');
  b.className = 'pill'; b.textContent = label; b.onclick = onclick;
  return b;
}

function setFilter(key, val, btn) {
  if (state.filters[key] === val) {
    state.filters[key] = null; btn.classList.remove('active');
  } else {
    btn.parentElement.querySelectorAll('.pill.active').forEach(b=>b.classList.remove('active'));
    state.filters[key] = val; btn.classList.add('active');
  }
  applyFilters(); updateChips(); updateFilterDot();
}

function updateChips() {
  const row = document.getElementById('chipsRow');
  row.innerHTML = '';
  const {day,area,type,search} = state.filters;
  if (day)    addChip(row,`Day: ${day}`,   ()=>clearFilter('day'));
  if (area)   addChip(row,`Area: ${area}`, ()=>clearFilter('area'));
  if (type)   addChip(row,`Type: ${type}`, ()=>clearFilter('type'));
  if (search) addChip(row,`"${search}"`, ()=>{
    state.filters.search=''; document.getElementById('searchBox').value='';
    applyFilters(); updateChips(); updateFilterDot();
  });
  if (state.favFilterOn) addChip(row,'♥ Favorites', ()=>{state.favFilterOn=false; document.getElementById('favFilterBtn').classList.remove('active'); applyFilters(); updateChips();});
}

function addChip(row,label,fn) {
  const c=document.createElement('div');
  c.className='chip';
  c.innerHTML=`${label} <span class="chip-x">✕</span>`;
  c.onclick=fn; row.appendChild(c);
}

function clearFilter(key) {
  state.filters[key]=null;
  const map={day:'dayFilters',area:'areaFilters',type:'typeFilters'};
  document.querySelectorAll(`#${map[key]} .pill.active`).forEach(b=>b.classList.remove('active'));
  applyFilters(); updateChips(); updateFilterDot();
}

function updateFilterDot() {
  const has=state.filters.day||state.filters.area||state.filters.type||state.favFilterOn;
  document.getElementById('filterDot').classList.toggle('show',!!has);
  document.getElementById('filterToggle').classList.toggle('active',!!has);
}

function applyFilters() {
  const search=(document.getElementById('searchBox').value||'').toLowerCase().trim();
  state.filters.search=search;
  state.filtered = VENUES.filter(v => {
    const {day,area,type} = state.filters;
    if (day  && !v.days.includes(day))    return false;
    if (area && v.neighborhood!==area)    return false;
    if (type) {
      const t=type.toLowerCase();
      if (!v.cuisine.toLowerCase().includes(t)&&!v.deals.some(d=>d.toLowerCase().includes(t))) return false;
    }
    if (search) {
      const hay=[v.name,v.neighborhood,v.cuisine,v.address,...v.deals].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (state.favFilterOn) {
      if (!isFavorite(v.id)) return false;
    }
    return true;
  });
  renderCards();
  if (state.view==='map') updateMapMarkers();
  document.getElementById('resultsCount').textContent=`${state.filtered.length} of ${VENUES.length} venues`;
}

// ── CARDS ─────────────────────────────────────────────────
function renderCards() {
  const grid=document.getElementById('cardsGrid');
  if (!state.filtered.length) {
    grid.innerHTML=`<div class="no-results"><span class="emoji">🥂</span>No venues match — try adjusting your filters!</div>`;
    return;
  }
  grid.innerHTML=state.filtered.map(cardHTML).join('');
}

function cardHTML(v) {
  const isToday = v.days.includes(TODAY);
  const cached  = state.reviewCache[v.id];
  const avg     = cached ? avgFromList(cached) : 0;
  const rcount  = cached ? cached.length : 0;
  const faved   = isFavorite(v.id);
  return `
  <div class="card" onclick="openModal(${v.id})" role="button" tabindex="0">
    <div class="card-head">
      <div class="card-name">${v.name}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button class="heart-btn${faved?' faved':''}" onclick="event.stopPropagation();handleFavorite(${v.id},this)" aria-label="Save to favorites">${faved?'♥':'♡'}</button>
        <div class="card-badge${isToday?'':' wn'}">${isToday?'Today':'Weekday'}</div>
      </div>
    </div>
    <div class="card-hood">${v.neighborhood} · ${v.zip}</div>
    <div class="card-when">${v.hours}</div>
    <ul class="deals">
      ${v.deals.slice(0,3).map(d=>`<li>${d}</li>`).join('')}
      ${v.deals.length>3?`<li class="deals-more">+${v.deals.length-3} more…</li>`:''}
    </ul>
    <div class="card-foot">
      <span class="card-cuisine">${v.cuisine}</span>
      <div class="card-stars">${starHTML(avg,5,13)}<span class="card-rcount">${rcount?`(${rcount})`:'No reviews'}</span></div>
    </div>
  </div>`;
}

async function handleFavorite(venueId, btn) {
  if (!currentUser) { openAuth('signin'); showToast('Sign in to save favorites 🌸'); return; }
  const added = await toggleFavorite(venueId);
  btn.textContent = added ? '♥' : '♡';
  btn.classList.toggle('faved', added);
  showToast(added ? 'Saved to favorites ♥' : 'Removed from favorites');
}

// ── VENUE MODAL ───────────────────────────────────────────
async function openModal(id) {
  const v = VENUES.find(x=>x.id===id);
  if (!v) return;
  state.activeVenueId = id;

  // Show modal immediately with skeleton reviews
  renderModal(v, null);
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Load reviews (cached or fresh)
  const reviews = await getCachedReviews(id);
  // Re-render just the reviews section
  const listEl = document.getElementById(`rlist-${id}`);
  const avgEl  = document.getElementById(`ravg-${id}`);
  if (listEl) listEl.innerHTML = renderReviewsList(reviews, id);
  if (avgEl) avgEl.innerHTML = reviewSummaryHTML(reviews);
}

async function getCachedReviews(venueId) {
  const now = Date.now();
  if (state.reviewCache[venueId] && (now - state.reviewCacheTime[venueId]) < CACHE_TTL) {
    return state.reviewCache[venueId];
  }
  const reviews = await fetchReviews(venueId);
  state.reviewCache[venueId] = reviews;
  state.reviewCacheTime[venueId] = now;
  return reviews;
}

async function refreshVenueReviews(venueId) {
  delete state.reviewCache[venueId];
  const reviews = await getCachedReviews(venueId);
  const listEl = document.getElementById(`rlist-${venueId}`);
  const avgEl  = document.getElementById(`ravg-${venueId}`);
  if (listEl) listEl.innerHTML = renderReviewsList(reviews, venueId);
  if (avgEl) avgEl.innerHTML = reviewSummaryHTML(reviews);
  renderCards();
}

function reviewSummaryHTML(reviews) {
  if (!reviews.length) return '';
  const avg = avgFromList(reviews);
  return `${starHTML(avg,5,12)} <span class="review-summary-text">${avg.toFixed(1)} · ${reviews.length} review${reviews.length!==1?'s':''}</span>`;
}

function renderModal(v, reviews) {
  const faved   = isFavorite(v.id);
  const cached  = reviews || state.reviewCache[v.id] || [];
  document.getElementById('modalContent').innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;padding-right:36px">
      <div style="flex:1">
        <div class="modal-name">${v.name}</div>
        <div class="modal-hood">${v.neighborhood}</div>
        <div class="modal-addr">📍 ${v.address}</div>
      </div>
      <button class="heart-btn heart-btn--lg${faved?' faved':''}"
        onclick="handleFavorite(${v.id},this)" aria-label="Save to favorites">${faved?'♥':'♡'}</button>
    </div>

    <div class="modal-divider"></div>
    <div class="modal-label">Happy Hour</div>
    <div class="modal-when-text">🌸 ${v.hours}</div>
    <div class="modal-label" style="margin-top:10px">Days</div>
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
    <div class="modal-label">
      Community Reviews <span id="ravg-${v.id}">${reviewSummaryHTML(cached)}</span>
    </div>

    <!-- Write review form -->
    <div class="review-form">
      <div class="star-picker" id="sp-${v.id}" data-val="0">
        ${[1,2,3,4,5].map(n=>`<button class="sp" onclick="pickStar(${v.id},${n})" aria-label="${n} stars">★</button>`).join('')}
      </div>
      ${!currentUser ? `<p class="review-guest-note">Reviewing as guest — <button class="auth-switch-btn" onclick="openAuth('signin')">sign in</button> to manage your reviews later</p>` : ''}
      <input  class="review-name-input" id="rname-${v.id}" type="text"
        value="${currentUser ? escHtml(currentUser.user_metadata?.full_name||'') : ''}"
        placeholder="Your name" ${currentUser?'style="display:none"':''} autocomplete="name">
      <textarea class="review-textarea" id="rtext-${v.id}"
        placeholder="How was the happy hour? Spill the tea ✨" rows="3"></textarea>
      <button class="review-submit" onclick="submitReview(${v.id})">Post Review ✦</button>
    </div>

    <!-- Reviews list -->
    <div class="reviews-list" id="rlist-${v.id}">
      ${cached.length ? renderReviewsList(cached, v.id) : '<div class="no-reviews">Loading reviews… 🌸</div>'}
    </div>
  `;
}

function renderReviewsList(reviews, venueId) {
  if (!reviews.length) return `<div class="no-reviews">No reviews yet — be the first! 🌸</div>`;
  return reviews.map(r => {
    const isOwn = currentUser && r.user_id === currentUser.id;
    const displayName = r.profiles?.display_name || r.name || 'Anonymous';
    return `
    <div class="review-item">
      <div class="review-item-head">
        <span class="review-author">${escHtml(displayName)}${isOwn?' <span class="review-you">(you)</span>':''}</span>
        <span class="review-stars">${starHTML(r.rating,5,12)}</span>
        <span class="review-date">${fmtDate(r.created_at)}</span>
      </div>
      ${r.text?`<div class="review-text">${escHtml(r.text)}</div>`:''}
      ${isOwn?`<div class="review-actions">
        <button class="review-act-btn" onclick="openEditReview('${r.id}',${venueId},${r.rating},\`${escHtml(r.text||'')}\`)">Edit</button>
        <button class="review-act-btn review-act-delete" onclick="confirmDeleteReview('${r.id}',${venueId})">Delete</button>
      </div>`:''}
    </div>`;
  }).join('');
}

function pickStar(venueId, n) {
  const p = document.getElementById(`sp-${venueId}`);
  p.dataset.val = n;
  p.querySelectorAll('.sp').forEach((b,i)=>b.classList.toggle('lit',i<n));
}

async function submitReview(venueId) {
  const picker  = document.getElementById(`sp-${venueId}`);
  const rating  = parseInt(picker.dataset.val||'0');
  if (!rating) { showToast('Pick a star rating first ⭐'); return; }

  const text      = document.getElementById(`rtext-${venueId}`).value.trim();
  const guestName = document.getElementById(`rname-${venueId}`)?.value.trim() || 'Anonymous';

  const { error } = await postReview({ venueId, rating, text, guestName });
  if (error) { showToast('❌ ' + error.message); return; }

  // Reset form
  picker.dataset.val='0';
  picker.querySelectorAll('.sp').forEach(b=>b.classList.remove('lit'));
  const textEl = document.getElementById(`rtext-${venueId}`);
  const nameEl = document.getElementById(`rname-${venueId}`);
  if (textEl) textEl.value='';
  if (nameEl) nameEl.value='';

  await refreshVenueReviews(venueId);
  showToast('Review posted! 🌸');
}

// ── SHARE ─────────────────────────────────────────────────
function shareVenue(id) {
  const v = VENUES.find(x=>x.id===id);
  if (!v) return;
  const msg = `🌸 Happy Hour Alert!\n\n${v.name}\n📍 ${v.neighborhood} — ${v.address}\n🕐 ${v.hours}\n✨ ${v.deals.slice(0,2).join(' · ')}\n\nSD Happy Hour Guide 🥂`;
  if (navigator.share) {
    navigator.share({title:`Happy Hour at ${v.name}`, text:msg}).catch(()=>{});
  } else {
    window.open(`sms:?body=${encodeURIComponent(msg)}`, '_blank');
  }
}

// ── MAP ───────────────────────────────────────────────────
function closeModal(e) {
  if (e && e.target!==document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow='';
}

function goToMapVenue(id) {
  closeModal();
  if (state.view!=='map') toggleView();
  setTimeout(()=>flyToVenue(id),350);
}

function toggleView() {
  const isMap = state.view==='map';
  state.view = isMap?'list':'map';
  document.getElementById('listView').classList.toggle('active',state.view==='list');
  document.getElementById('mapView').classList.toggle('active',state.view==='map');
  document.getElementById('viewIcon').textContent = state.view==='map'?'☰':'🗺';
  document.getElementById('viewToggle').classList.toggle('map-active',state.view==='map');
  if (state.view==='map') setTimeout(()=>{state.map.invalidateSize();updateMapMarkers();buildMapSidebar();},100);
}

function toggleFilters() {
  state.filtersOpen=!state.filtersOpen;
  document.getElementById('filterPanel').classList.toggle('open',state.filtersOpen);
  document.getElementById('filterToggle').classList.toggle('active',state.filtersOpen);
}

function initMap() {
  const map = L.map('map',{center:[32.82,-117.18],zoom:11});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
    attribution:'© OpenStreetMap © CARTO',subdomains:'abcd',maxZoom:19
  }).addTo(map);
  state.map=map;
}

function updateMapMarkers() {
  Object.values(state.markers).forEach(m=>m.remove());
  state.markers={};
  state.filtered.forEach(v=>{
    const color = v.days.includes(TODAY)?'#E8547A':'#9B7BAA';
    const icon = L.divIcon({
      className:'',
      html:`<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2.5px solid rgba(255,255,255,0.85);box-shadow:0 3px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px;line-height:1">🍹</span></div>`,
      iconSize:[28,28],iconAnchor:[14,28],popupAnchor:[0,-30]
    });
    const marker=L.marker([v.lat,v.lng],{icon})
      .addTo(state.map)
      .bindPopup(popupHTML(v),{maxWidth:260});
    marker.on('click',()=>highlightMapCard(v.id));
    state.markers[v.id]=marker;
  });
}

function popupHTML(v) {
  return `<div class="popup-body">
    <div class="popup-name">${v.name}</div>
    <div class="popup-hood">${v.neighborhood}</div>
    <div class="popup-when">🌸 ${v.hours}</div>
    ${v.deals.slice(0,2).map(d=>`<div class="popup-deal">${d}</div>`).join('')}
    <div class="popup-actions">
      <button class="popup-btn" onclick="openModal(${v.id})">Details →</button>
      <button class="popup-share" onclick="shareVenue(${v.id})">💬 Share</button>
    </div>
  </div>`;
}

function flyToVenue(id) {
  const v=VENUES.find(x=>x.id===id);
  if (!v||!state.map) return;
  state.map.flyTo([v.lat,v.lng],15,{animate:true,duration:0.8});
  if (state.markers[id]) setTimeout(()=>state.markers[id].openPopup(),900);
  highlightMapCard(id);
}

function highlightMapCard(id) {
  document.querySelectorAll('.map-card').forEach(c=>c.classList.toggle('highlighted',c.dataset.id==id));
  const c=document.querySelector(`.map-card[data-id="${id}"]`);
  if (c) c.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function buildMapSidebar() {
  document.getElementById('mapCards').innerHTML=state.filtered.map(v=>`
    <div class="map-card" data-id="${v.id}" onclick="flyToVenue(${v.id})">
      <div class="map-card-name">${v.name}</div>
      <div class="map-card-hood">${v.neighborhood}</div>
      <div class="map-card-when">${v.hours}</div>
    </div>`).join('');
}

// ── UTILS ─────────────────────────────────────────────────
function avgFromList(reviews) {
  if (!reviews.length) return 0;
  return reviews.reduce((s,r)=>s+r.rating,0)/reviews.length;
}

function starHTML(rating,max=5,size=14) {
  return Array.from({length:max},(_,i)=>
    `<span style="font-size:${size}px;color:${i<Math.round(rating)?'var(--gold)':'rgba(255,180,200,0.2)'}" aria-hidden="true">★</span>`
  ).join('');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function showToast(msg) {
  // remove any existing
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');
  t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2800);
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
