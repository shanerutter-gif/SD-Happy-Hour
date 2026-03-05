# 🌸 SD Happy Hour Guide — Full-Stack Edition

**85+ happy hour venues across San Diego County** with a live Supabase database, user authentication, community reviews, favorites, neighborhood follows, and a weekly email digest.

---

## 🗂 Project Structure

```
sd-happyhour/
├── index.html              Main app
├── css/style.css           All styles (mobile-first, rose theme)
├── js/
│   ├── app.js              UI logic — filters, map, modals, reviews
│   └── supabase.js         DB client + all data helpers
├── data/venues.js          85+ venue records with lat/lng
├── api/
│   └── weekly-digest.js    Vercel Edge Function — weekly email cron
├── sql/
│   └── schema.sql          Full Postgres schema + RLS policies
├── vercel.json             Deployment + cron config
└── README.md
```

---

## ⚙️ Setup (5 steps, ~10 minutes)

### 1. Create your Supabase project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Give it a name, set a database password, pick a region (US West is closest to SD)
3. Wait ~2 minutes for it to provision

### 2. Run the SQL schema
1. In your Supabase dashboard → **SQL Editor** → New Query
2. Paste the full contents of `sql/schema.sql`
3. Click **Run** — creates all tables, indexes, RLS policies, and triggers

### 3. Add your Supabase keys to the client
Open `js/supabase.js` and replace the placeholders at the top:

```js
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

Find these in: Supabase Dashboard → **Project Settings → API**
- **URL**: the Project URL
- **Anon Key**: the `anon` `public` key (safe to expose in browser code — RLS handles security)

### 4. Deploy to Vercel
```bash
# Option A: CLI
npm i -g vercel
vercel

# Option B: GitHub
git init && git add . && git commit -m "✨ SD Happy Hour"
# Push to GitHub, then import at vercel.com → New Project
```

### 5. Add environment variables in Vercel
Go to Vercel Dashboard → Your Project → **Settings → Environment Variables**:

| Variable | Value | Where to find |
|---|---|---|
| `SUPABASE_URL` | `https://xyz.supabase.co` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | `eyJ...` (service_role key) | Supabase → Project Settings → API |
| `RESEND_API_KEY` | `re_...` | [resend.com](https://resend.com) → API Keys |
| `CRON_SECRET` | any random string | You create this |

> ⚠️ The `SUPABASE_SERVICE_KEY` (service_role) is **only used server-side** in the API route — never put it in the browser JS. The anon key in `supabase.js` is fine to expose.

---

## ✉️ Weekly Email Digest

- Runs every **Monday at 10am UTC** (edit the cron schedule in `vercel.json`)
- Uses [Resend](https://resend.com) for email (free tier = 3,000 emails/month)
- Only sends to users who enabled digest in their profile
- Respects followed neighborhoods — personalizes the venue list per user

**To use a custom domain** for "from" address, add your domain in Resend and update the `from` field in `api/weekly-digest.js`.

---

## 🔐 Auth Flow

- **Sign up**: email + password → confirmation email sent by Supabase
- **Sign in**: standard email/password session with auto-refresh
- **Password reset**: "Forgot password?" link → magic link email
- Sessions persist across page reloads via `localStorage` (handled by Supabase client)

To enable **Email Confirmations** (recommended for production):
Supabase Dashboard → Authentication → Email Templates → enable "Confirm signup"

---

## 🌟 Features by Auth State

| Feature | Guest | Logged In |
|---|---|---|
| Browse all venues | ✅ | ✅ |
| Filter & search | ✅ | ✅ |
| View map | ✅ | ✅ |
| Read reviews | ✅ | ✅ |
| Post reviews (as guest) | ✅ | ✅ |
| Edit / delete own reviews | ❌ | ✅ |
| Save favorites (♥ heart) | ❌ | ✅ |
| Filter by favorites | ❌ | ✅ |
| Follow neighborhoods | ❌ | ✅ |
| Weekly digest email | ❌ | ✅ (opt-in) |
| Profile page | ❌ | ✅ |

---

## ➕ Adding Venues

Open `data/venues.js` and add to the `VENUES` array. Each venue needs:

```js
{
  id:           86,           // unique integer
  name:         "Bar Name",
  neighborhood: "North Park", // must match AREAS list in app.js
  address:      "1234 30th St, San Diego, CA 92104",
  lat:          32.7517,      // right-click on Google Maps to copy
  lng:          -117.1283,
  zip:          "92104",
  days:         ["Mon","Tue","Wed","Thu","Fri"],
  hours:        "4pm – 7pm",
  cuisine:      "American",
  deals:        ["$5 draft beers", "$7 cocktails"],
  type:         "happyhour",
  url:          "https://barname.com",  // or "#" if none
  accent:       "#E8547A"               // optional
}
```

---

## 🎨 Customization

**Colors** — edit CSS variables in `css/style.css`:
```css
:root {
  --rose:    #E8547A;
  --blush:   #F4A7BB;
  --gold:    #D4A853;
  --dark:    #1A0D14;
}
```

**Site title** — edit `<h1>` in `index.html`

**Digest schedule** — edit `"schedule"` in `vercel.json` (uses cron syntax)

---

## 📄 License

MIT. Data from SD Magazine, SD Union-Tribune, King of Happy Hour & venue sites.  
Always verify happy hour times directly — they change!

*Built with 🌸 — SD Happy Hour Guide 2025*
