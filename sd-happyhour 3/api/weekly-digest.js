/* ═══════════════════════════════════════════════════════
   WEEKLY DIGEST — api/weekly-digest.js
   Vercel Serverless Function
   
   Schedule: Set a cron in vercel.json to call this weekly.
   
   It queries all users with digest_enabled = true,
   fetches their followed neighborhoods, finds venues in
   those neighborhoods, and sends a digest email via Resend.
   
   Required env vars in Vercel dashboard:
     SUPABASE_URL          (same as frontend)
     SUPABASE_SERVICE_KEY  (Service Role key — NOT anon key)
     RESEND_API_KEY        (resend.com — free tier = 3k emails/mo)
   ═══════════════════════════════════════════════════════ */

export const config = { runtime: 'edge' };

// Inline venue data (same as data/venues.js — keep in sync)
// In production you'd import from a shared module or DB
const VENUE_COUNT = 85;

export default async function handler(req) {
  // Verify this is called by Vercel Cron (or manually with secret)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl     = process.env.SUPABASE_URL;
  const supabaseService = process.env.SUPABASE_SERVICE_KEY;
  const resendKey       = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !supabaseService || !resendKey) {
    return new Response('Missing env vars', { status: 500 });
  }

  // ── 1. Get all users opted in to digest ─────────────────
  const profilesRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?digest_enabled=eq.true&select=id,display_name`,
    { headers: { 'apikey': supabaseService, 'Authorization': `Bearer ${supabaseService}` } }
  );
  const profiles = await profilesRes.json();
  if (!profiles.length) return new Response('No digest subscribers', { status: 200 });

  // ── 2. Get auth emails for these users ───────────────────
  const emailsRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users`,
    { headers: { 'apikey': supabaseService, 'Authorization': `Bearer ${supabaseService}` } }
  );
  const { users } = await emailsRes.json();
  const emailMap = Object.fromEntries(users.map(u => [u.id, u.email]));

  // ── 3. For each subscriber, get followed hoods + send ───
  let sent = 0;
  for (const profile of profiles) {
    const email = emailMap[profile.id];
    if (!email) continue;

    // Get followed neighborhoods
    const followsRes = await fetch(
      `${supabaseUrl}/rest/v1/neighborhood_follows?user_id=eq.${profile.id}&select=neighborhood`,
      { headers: { 'apikey': supabaseService, 'Authorization': `Bearer ${supabaseService}` } }
    );
    const follows = await followsRes.json();
    const hoods = follows.map(f => f.neighborhood);

    // Build digest HTML
    const html = buildDigestHTML(profile.display_name || 'Friend', hoods);

    // Send via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from:    'SD Happy Hour <digest@yourdomain.com>',
        to:      email,
        subject: `🌸 Your Weekly SD Happy Hour Digest`,
        html
      })
    });
    sent++;
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function buildDigestHTML(name, followedHoods) {
  const greeting = followedHoods.length
    ? `Here are this week's picks for your followed neighborhoods: <strong>${followedHoods.join(', ')}</strong>`
    : `Here are this week's staff picks across all of San Diego County`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#1A0D14;font-family:'DM Sans',Helvetica,sans-serif;color:#FFF0F4}
  .wrap{max-width:560px;margin:0 auto;padding:32px 24px}
  .logo{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#F4A7BB;opacity:.7;margin-bottom:24px}
  h1{font-size:28px;font-weight:900;font-style:italic;margin:0 0 8px;
     background:linear-gradient(135deg,#fff 15%,#F4A7BB 55%,#D4A853 100%);
     -webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .intro{font-size:14px;color:rgba(255,220,230,.65);margin-bottom:28px;line-height:1.7}
  .venue-card{background:#2A1520;border:1px solid rgba(232,84,122,.18);border-radius:16px;padding:16px;margin-bottom:14px}
  .venue-name{font-size:16px;font-weight:700;color:#FFF0F4;margin-bottom:3px}
  .venue-hood{font-size:10px;color:#F4A7BB;opacity:.65;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
  .venue-hours{font-size:12px;color:rgba(255,200,215,.5);margin-bottom:8px}
  .deal{font-size:13px;color:rgba(255,220,230,.75);padding:5px 14px;background:rgba(232,84,122,.08);border-radius:50px;display:inline-block;margin:3px 3px 0 0}
  .cta{display:block;text-align:center;margin-top:28px;background:linear-gradient(135deg,#E8547A,#C03060);color:#fff;text-decoration:none;border-radius:50px;padding:15px 28px;font-weight:700;font-size:15px}
  .footer{margin-top:32px;font-size:10px;color:rgba(255,180,200,.22);text-align:center;line-height:1.9}
  .footer a{color:rgba(255,180,200,.4);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">✦ SD Happy Hour Guide</div>
  <h1>Girls' Night Out Picks 🌸</h1>
  <p class="intro">Hi ${escHtml(name)}! ${greeting}.</p>

  <!-- Featured venues would be dynamically populated here -->
  <!-- In production, query your DB or pass venues through the function -->
  <div class="venue-card">
    <div class="venue-name">Cloak &amp; Petal</div>
    <div class="venue-hood">Little Italy</div>
    <div class="venue-hours">🌸 Mon–Fri 4–6pm</div>
    <span class="deal">$13 specialty cocktails</span>
    <span class="deal">$8 sake</span>
    <span class="deal">$5 garlic edamame</span>
  </div>

  <div class="venue-card">
    <div class="venue-name">The Smoking Gun</div>
    <div class="venue-hood">Gaslamp</div>
    <div class="venue-hours">🌸 Mon–Fri 3–7pm</div>
    <span class="deal">$6 Japanese Highball</span>
    <span class="deal">$30 Punch Bowl (serves 4)</span>
  </div>

  <div class="venue-card">
    <div class="venue-name">Duke's La Jolla</div>
    <div class="venue-hood">La Jolla</div>
    <div class="venue-hours">🌸 Daily 3–6pm</div>
    <span class="deal">1/2 off drinks</span>
    <span class="deal">1/2 off apps</span>
    <span class="deal">$19.42 Don Julio 1942</span>
  </div>

  <a href="https://yourdomain.com" class="cta">See All 85+ Venues →</a>

  <div class="footer">
    <p>You're receiving this because you enabled weekly digests in your SD Happy Hour account.</p>
    <p><a href="https://yourdomain.com">Manage preferences</a> · <a href="https://yourdomain.com">Unsubscribe</a></p>
    <p>Always verify happy hour times directly with venues as they may change.</p>
  </div>
</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
