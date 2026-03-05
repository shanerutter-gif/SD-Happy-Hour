/* ═══════════════════════════════════════════════════════
   SUPABASE CLIENT — js/supabase.js
   Replace SUPABASE_URL and SUPABASE_ANON_KEY with your
   values from supabase.com → Project Settings → API
   ═══════════════════════════════════════════════════════ */

const SUPABASE_URL      = 'https://opcskuzbdfrlnyhraysk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wY3NrdXpiZGZybG55aHJheXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDQ3MTcsImV4cCI6MjA4ODMyMDcxN30.9LXr-oFTLmYEZrlVt1zOvRFvJ8998YkTmrHJ7yNv81EE';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// ── AUTH STATE ────────────────────────────────────────────
let currentUser = null;
let userFavorites = new Set();

db.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    await loadFavorites();
  } else {
    userFavorites = new Set();
  }
  if (typeof onAuthChange === 'function') onAuthChange(currentUser);
});

async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

// ── AUTH METHODS ──────────────────────────────────────────
async function authSignUp(email, password, displayName) {
  const { data, error } = await db.auth.signUp({
    email, password,
    options: { data: { full_name: displayName } }
  });
  return { data, error };
}

async function authSignIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return { data, error };
}

async function authSignOut() {
  const { error } = await db.auth.signOut();
  return error;
}

// ── PROFILE ───────────────────────────────────────────────
async function getProfile(userId) {
  const { data } = await db.from('profiles')
    .select('*').eq('id', userId).single();
  return data;
}

async function updateProfile(userId, updates) {
  const { data, error } = await db.from('profiles')
    .upsert({ id: userId, ...updates });
  return { data, error };
}

async function getFollowedNeighborhoods(userId) {
  const { data } = await db.from('neighborhood_follows')
    .select('neighborhood').eq('user_id', userId);
  return (data || []).map(r => r.neighborhood);
}

async function toggleNeighborhoodFollow(userId, neighborhood) {
  const followed = await getFollowedNeighborhoods(userId);
  if (followed.includes(neighborhood)) {
    await db.from('neighborhood_follows')
      .delete().eq('user_id', userId).eq('neighborhood', neighborhood);
    return false;
  } else {
    await db.from('neighborhood_follows')
      .insert({ user_id: userId, neighborhood });
    return true;
  }
}

// ── REVIEWS ───────────────────────────────────────────────
async function fetchReviews(venueId) {
  const { data } = await db.from('reviews')
    .select('*, profiles(display_name)')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  return data || [];
}

async function fetchMyReviews(userId) {
  const { data } = await db.from('reviews')
    .select('*').eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

async function postReview({ venueId, rating, text, guestName }) {
  const session = await getSession();
  const payload = {
    venue_id: venueId,
    rating,
    text: text || null,
    user_id:  session?.user?.id  || null,
    name: session?.user?.user_metadata?.full_name || guestName || 'Anonymous'
  };
  const { data, error } = await db.from('reviews').insert(payload).select().single();
  return { data, error };
}

async function updateReview(reviewId, { rating, text }) {
  const { data, error } = await db.from('reviews')
    .update({ rating, text, updated_at: new Date().toISOString() })
    .eq('id', reviewId).select().single();
  return { data, error };
}

async function deleteReview(reviewId) {
  const { error } = await db.from('reviews').delete().eq('id', reviewId);
  return error;
}

// ── FAVORITES ─────────────────────────────────────────────
async function loadFavorites() {
  if (!currentUser) { userFavorites = new Set(); return; }
  const { data } = await db.from('favorites')
    .select('venue_id').eq('user_id', currentUser.id);
  userFavorites = new Set((data || []).map(r => r.venue_id));
}

function isFavorite(venueId) {
  return userFavorites.has(venueId);
}

async function toggleFavorite(venueId) {
  if (!currentUser) return null; // signal: not logged in
  if (isFavorite(venueId)) {
    await db.from('favorites')
      .delete().eq('user_id', currentUser.id).eq('venue_id', venueId);
    userFavorites.delete(venueId);
    return false;
  } else {
    await db.from('favorites')
      .insert({ user_id: currentUser.id, venue_id: venueId });
    userFavorites.add(venueId);
    return true;
  }
}

async function getFavoriteVenues(userId) {
  const { data } = await db.from('favorites')
    .select('venue_id').eq('user_id', userId);
  return (data || []).map(r => r.venue_id);
}

// ── EMAIL DIGEST PREFERENCE ───────────────────────────────
async function setDigestPreference(userId, enabled) {
  return db.from('profiles')
    .update({ digest_enabled: enabled }).eq('id', userId);
}

// Alias used internally by app.js loadFavorites flow
async function fetchFavorites() {
  if (!currentUser) return [];
  return getFavoriteVenues(currentUser.id);
}
