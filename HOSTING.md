# SwipeKill hosting status

**Live:** https://jayjasmine.github.io/swipekill/ (GitHub Pages, `main` root)

- Stripe success redirect (Jay-only): set Payment Link after-completion to
  `https://jayjasmine.github.io/swipekill/success.html`
- Do not resume Meta ads until that Stripe redirect is set (see ADS.md).
- Local QA: `python3 serve.py` on :8765. Pack: `bash deploy/pack.sh` → `dist/swipekill-static.tgz`.
- Repo: https://github.com/jayjasmine/swipekill
- Full alternate steps: DEPLOY-VPS.md (not used for this host).
