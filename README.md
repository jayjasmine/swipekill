# SwipeKill — Photo Autopsy

A $19 one-time dating-photo autopsy for men 21–35. Upload 4–6 photos. Scores stay locked until paid. Then: rank, KILL stamp, what goes first, bury two, three fixes (light / crop / expression).

Static HTML/CSS/JS. No backend. No account. Scoring runs in the browser.

## Open locally

From this folder:

```bash
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/).

You can also open `index.html` directly, but a local server is more reliable for uploads and IndexedDB.

### Demo the report without Stripe

1. Upload 4–6 photos, check the 21+ and “no nudes” boxes, continue.
2. Production keeps `ALLOW_TEST_UNLOCK: false` in `js/config.js`, so `?unlocked=1` does **not** unlock.
   For local QA only, set that flag to `true`, then:

```
http://127.0.0.1:8080/paywall.html?unlocked=1
http://127.0.0.1:8080/report.html?unlocked=1
```

Or open `success.html` (the real Stripe return path), which still unlocks this device.
The query-string unlock does not charge anyone and does not pretend Stripe succeeded.

## Paste a Stripe Payment Link

1. Create the product in Stripe (see `OFFER.md`): **SwipeKill Photo Autopsy**, **$19 USD**, **one-time**.
2. Create a Payment Link for that price.
3. In the Payment Link, set after-completion redirect to:

```
https://YOUR-DOMAIN/success.html
```

4. Open `js/config.js` and paste the link:

```js
STRIPE_PAYMENT_LINK: "https://buy.stripe.com/xxxxxxxx",
```

Until that string is non-empty, the Pay button will **not** unlock the report and will **not** fake a successful payment. Testers use `?unlocked=1`.

## Deploy

Do not commit secrets. This repo has none. The Payment Link URL is public by design (it is a checkout URL).

### GitHub Pages

1. Create a GitHub repo. Push this folder to the repo root (so `index.html` is at `/`).

```bash
git init
git add .
git commit -m "Ship SwipeKill Photo Autopsy"
git branch -M main
git remote add origin https://github.com/YOU/swipekill.git
git push -u origin main
```

2. GitHub → **Settings** → **Pages**.
3. Source: **Deploy from a branch**. Branch: `main`. Folder: `/ (root)`.
4. Wait for the Pages URL. Put that origin on the Stripe Payment Link success redirect: `https://YOU.github.io/swipekill/success.html` (project site) or `https://YOU.github.io/success.html` (user/org site).
5. If this is a project site (`username.github.io/repo/`), keep all links relative (they already are). Open the site at `https://YOU.github.io/REPO/`.

### Cloudflare Pages

1. Push the same repo to GitHub or GitLab.
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Framework preset: **None**. Build command: empty. Output directory: `/` (leave default; this is a static root).
4. Deploy. Copy the `*.pages.dev` URL (or attach a custom domain).
5. Set the Stripe Payment Link redirect to `https://YOUR-PAGES-DOMAIN/success.html`.
6. Paste the Payment Link into `js/config.js`, commit, push. Pages will redeploy.

## What is left before a stranger can pay

1. Stripe product + Payment Link ($19 one-time) pasted into `js/config.js`.
2. Host the folder on GitHub Pages or Cloudflare Pages (or any static host).
3. Point the Payment Link success URL at `https://YOUR-DOMAIN/success.html`.

No app store. No backend. No waitlist.

## Legal-lite

Entertainment and dating-app advice for adults 21+. Not a scientific rating. No nudes.
