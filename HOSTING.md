# SwipeKill hosting status

**Live (GitHub Pages):** https://jayjasmine.github.io/swipekill/

Repo: https://github.com/jayjasmine/swipekill (public, `main` → Pages root).

## Still blocked (Jay-only)

Stripe Payment Link after-completion redirect must be:

```
https://jayjasmine.github.io/swipekill/success.html
```

Without that redirect, paid buyers do not unlock the report on-device.

- Do not resume Meta ads until that Stripe redirect is confirmed.
- Local QA: `python3 serve.py` on :8765. Pack: `bash deploy/pack.sh` → `dist/swipekill-static.tgz`.
- VPS path (optional later): DEPLOY-VPS.md — still needs SSH/DO login; Pages is the durable host for now.
