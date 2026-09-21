#!/usr/bin/env bash
# Ping IndexNow (Bing/Yep) with sitemap URLs. Key file is public on Pages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="jayjasmine.github.io"
KEY="c866be82ab247c58750647b90f4edfca"
KEY_LOCATION="https://jayjasmine.github.io/swipekill/${KEY}.txt"
ENDPOINT="https://api.indexnow.org/indexnow"

if [[ -f "$ROOT/${KEY}.txt" ]]; then
  FILE_KEY="$(tr -d '[:space:]' < "$ROOT/${KEY}.txt")"
  if [[ "$FILE_KEY" != "$KEY" ]]; then
    echo "IndexNow key file does not match $KEY" >&2
    exit 1
  fi
fi

URLS=()
if [[ -f "$ROOT/sitemap.xml" ]]; then
  while IFS= read -r loc; do
    [[ -n "$loc" ]] && URLS+=("$loc")
  done < <(sed -n 's/.*<loc>\([^<]*\)<\/loc>.*/\1/p' "$ROOT/sitemap.xml")
fi
if [[ ${#URLS[@]} -eq 0 ]]; then
  URLS=(
    "https://jayjasmine.github.io/swipekill/"
    "https://jayjasmine.github.io/swipekill/upload.html"
    "https://jayjasmine.github.io/swipekill/paywall.html"
    "https://jayjasmine.github.io/swipekill/tips/first-photo-kills-matches.html"
    "https://jayjasmine.github.io/swipekill/tips/group-vs-solo-lead.html"
    "https://jayjasmine.github.io/swipekill/tips/bathroom-mirror-dark-lighting.html"
  )
fi

JSON_URLS=""
for u in "${URLS[@]}"; do
  [[ -n "$JSON_URLS" ]] && JSON_URLS+=","
  JSON_URLS+="\"$u\""
done

BODY=$(cat <<EOF
{"host":"${HOST}","key":"${KEY}","keyLocation":"${KEY_LOCATION}","urlList":[${JSON_URLS}]}
EOF
)

echo "POST $ENDPOINT"
echo "$BODY"

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
CODE="$(curl -sS -o "$TMP" -w '%{http_code}' \
  -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data "$BODY")"
RESP="$(cat "$TMP")"

echo "HTTP $CODE"
[[ -n "$RESP" ]] && echo "$RESP"

if [[ "$CODE" == "200" || "$CODE" == "202" ]]; then
  echo "IndexNow accepted."
  exit 0
fi
echo "IndexNow failed (want 200 or 202)." >&2
exit 1
