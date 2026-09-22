#!/usr/bin/env bash
# Pack SwipeKill static site for scp → VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
OUT="$DIST/swipekill-static.tgz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DIST"

# Include qa-photos when small (< 5MB). Exclude when huge.
QA_DIR="$ROOT/qa-photos"
INCLUDE_QA=0
if [[ -d "$QA_DIR" ]]; then
  QA_BYTES="$(du -sb "$QA_DIR" 2>/dev/null | awk '{print $1}')"
  if [[ "${QA_BYTES:-0}" -lt 5242880 ]]; then
    INCLUDE_QA=1
  fi
fi

STAGE="$TMP/swipekill"
mkdir -p "$STAGE"

# Core static site (no serve.py needed on VPS; keep it for local QA)
cp -a "$ROOT/index.html" "$ROOT/upload.html" "$ROOT/paywall.html" \
  "$ROOT/report.html" "$ROOT/success.html" "$ROOT/sample-report.html" "$ROOT/favicon.svg" \
  "$ROOT/serve.py" "$STAGE/"
for seo in robots.txt sitemap.xml; do
  [[ -f "$ROOT/$seo" ]] && cp -a "$ROOT/$seo" "$STAGE/"
done
cp -a "$ROOT/css" "$ROOT/js" "$STAGE/"

# Docs useful on VPS
for f in README.md OFFER.md ADS.md DEPLOY-VPS.md HOSTING.md SHARE_COPY.md; do
  [[ -f "$ROOT/$f" ]] && cp -a "$ROOT/$f" "$STAGE/"
done
[[ -d "$ROOT/deploy" ]] && cp -a "$ROOT/deploy" "$STAGE/"

if [[ "$INCLUDE_QA" -eq 1 ]]; then
  cp -a "$QA_DIR" "$STAGE/"
fi

# Exclude local junk if any slipped in
tar -C "$TMP" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='*.tgz' \
  --exclude='.DS_Store' \
  -czf "$OUT" swipekill

ls -lh "$OUT"
echo "Packed: $OUT"
if [[ "$INCLUDE_QA" -eq 1 ]]; then
  echo "qa-photos: included (${QA_BYTES} bytes)"
else
  echo "qa-photos: excluded (missing or >= 5MB)"
fi
