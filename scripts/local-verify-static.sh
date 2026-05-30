#!/usr/bin/env bash
# Spring Boot 없이 static/sample·홈 푸터만 빠르게 확인
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATIC="$ROOT/src/main/resources/static"
PORT="${PORT:-8080}"

echo "Serving $STATIC on http://127.0.0.1:$PORT"
echo "  홈:    http://127.0.0.1:$PORT/"
echo "  샘플:  http://127.0.0.1:$PORT/sample/"
echo "Ctrl+C to stop"
cd "$STATIC"
python3 -m http.server "$PORT"
