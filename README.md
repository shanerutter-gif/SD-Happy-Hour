# 🌸 SD Happy Hour Guide — Girls' Night Out

**85+ happy hour venues across San Diego County** — filterable by day, neighborhood, and type. Features a live map view, AI concierge, and a beautiful mobile-first design.

---

## ✨ Features

- **85+ venues** across all of SD County — Gaslamp, Little Italy, PB, La Jolla, Encinitas, Carlsbad, Oceanside & more
- **Interactive Leaflet map** — tap any pin to see details, sidebar list on desktop
- **Smart filters** — by day of week, neighborhood, cuisine type
- **AI Concierge** — powered by Claude API; ask anything like *"best oyster happy hours near the beach"*
- **Mobile-first** — 44px touch targets, bottom-sheet modals, pill-scroll filters
- **Girly rose theme** — Playfair Display, blush/rose/gold palette, sparkle details

---

## 🚀 Deploy to Vercel (30 seconds)

### Option 1: Drag & Drop
1. Go to [vercel.com](https://vercel.com) → New Project
2. Drag this folder into the upload zone
3. Click Deploy — done! ✓

### Option 2: Via GitHub
```bash
# 1. Create a new repo on GitHub and push this folder
git init
git add .
git commit -m "✨ SD Happy Hour Guide"
git remote add origin https://github.com/YOUR_USERNAME/sd-happyhour.git
git push -u origin main

# 2. Go to vercel.com → New Project → Import from GitHub
# 3. Select your repo → Deploy
```

### Option 3: Vercel CLI
```bash
npm i -g vercel
cd sd-happyhour
vercel
```

---

## 🤖 Enable AI Concierge

The AI concierge uses the Anthropic Claude API. To enable it:

1. Get a free API key at [console.anthropic.com](https://console.anthropic.com)
2. Open `js/app.js` and find the `askAI()` function
3. The API key is passed via the standard Anthropic browser API (works on Vercel)

> **Note:** For production, use a serverless function to proxy the API call and keep your key secret. See the `api/` folder option below.

### Optional: Secure API proxy (recommended for production)

Create `api/ask.js` (Vercel serverless function):
```js
export default async function handler(req, res) {
  const { query, context } = req.body;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: context,
      messages: [{ role: 'user', content: query }]
    })
  });
  const data = await response.json();
  res.json(data);
}
```

Then add `ANTHROPIC_API_KEY` to your Vercel environment variables.

---

## 📁 Project Structure

```
sd-happyhour/
├── index.html          # Main app shell
├── css/
│   └── style.css       # All styles (mobile-first)
├── js/
│   └── app.js          # Filtering, map, modals, AI
├── data/
│   └── venues.js       # 85+ venue data with lat/lng
├── vercel.json         # Vercel deployment config
└── README.md           # This file
```

---

## ➕ Adding / Updating Venues

Open `data/venues.js` and add a new object to the `VENUES` array:

```js
{
  id: 86,                          // unique number
  name: "My New Bar",
  neighborhood: "North Park",
  address: "1234 30th St, San Diego, CA 92104",
  lat: 32.7517,                    // Google Maps lat
  lng: -117.1283,                  // Google Maps lng
  zip: "92104",
  days: ["Mon","Tue","Wed","Thu","Fri"],
  hours: "4pm – 7pm",
  cuisine: "American",
  deals: ["$5 draft beers", "$7 cocktails", "Half-off apps"],
  type: "happyhour",
  url: "https://mybar.com",
  accent: "#E8547A"                // optional pin color
}
```

---

## 🗺 Map Data

Coordinates use WGS84 decimal degrees (standard GPS).  
To find coordinates: Google Maps → right-click any location → copy lat/lng.

Map tiles provided by **OpenStreetMap + CARTO** (free, no API key needed).

---

## 🎨 Customization

**Colors:** Edit CSS variables in `css/style.css`:
```css
:root {
  --rose:  #E8547A;   /* primary accent */
  --blush: #F4A7BB;   /* secondary pink */
  --gold:  #D4A853;   /* tertiary gold */
  --dark:  #1A0D14;   /* background */
}
```

**Title:** Edit the `<h1>` in `index.html`.

---

## 📄 License

MIT — free to use, fork, and customize. Attribution appreciated but not required.

Data sourced from SD Magazine, SD Union-Tribune, King of Happy Hour, and individual venue websites. Always verify hours directly with restaurants as they may change.

---

*Built with 🌸 — SD Happy Hour Guide 2025*
