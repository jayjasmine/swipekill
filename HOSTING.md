# SwipeKill hosting status

**Live (GitHub Pages):** https://jayjasmine.github.io/swipekill/

Repo: https://github.com/jayjasmine/swipekill (public, `main` → Pages root).

## Stripe redirect (ads still paused)

Organic buyers can unlock without the Stripe after-completion redirect: pay on Stripe, return to the paywall tab, tap Unlock my report → `success.html`.

Meta ads still require after-completion redirect to:

```
https://jayjasmine.github.io/swipekill/success.html
```

- Do not resume Meta ads until that Stripe redirect is confirmed.
- Local QA: `python3 serve.py` on :8765. Pack: `bash deploy/pack.sh` → `dist/swipekill-static.tgz`.
- VPS path (optional later): DEPLOY-VPS.md — still needs SSH/DO login; Pages is the durable host for now.

## Discoverability (organic)

- `robots.txt` + `sitemap.xml` on Pages root.
- Open Graph / Product JSON-LD on `index.html`, plus `assets/og-share.png` (1200×630) for `og:image` / `twitter:image`.
- Ready share copy: `SHARE_COPY.md` (do not auto-post as Jay).
- Meta ads remain paused until Stripe success redirect is confirmed.
