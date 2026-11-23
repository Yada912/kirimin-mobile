#!/usr/bin/env bash
# Start the Kirimin backend so phones with the APK can connect (macOS / Linux).
#   ./scripts/start-backend-for-phones.sh           # same Wi-Fi
#   ./scripts/start-backend-for-phones.sh --tunnel  # any network (needs cloudflared)
set -euo pipefail
PORT="${PORT:-3000}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Same Wi-Fi: enter one of these in the app (Alamat server):"
for ip in $( (hostname -I 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || true) ); do
  echo "    http://$ip:$PORT"
done
echo

if [[ "${1:-}" == "--tunnel" ]]; then
  if command -v cloudflared >/dev/null; then
    LOG="$(mktemp)"
    cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
    for _ in $(seq 1 30); do
      URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
      [[ -n "$URL" ]] && break; sleep 1
    done
    echo "Any network: enter this in the app (Alamat server):"
    echo "    ${URL:-(not ready yet, see $LOG)}"
    echo
  else
    echo "cloudflared not installed (brew install cloudflared / see docs/APK-CONNECT.md)"
  fi
fi

cd "$ROOT/server"
HOST=0.0.0.0 PORT="$PORT" npm start
