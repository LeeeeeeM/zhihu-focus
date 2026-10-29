#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
cd "$BACKEND_DIR"

AIR_BIN=""
if command -v air >/dev/null 2>&1; then
  AIR_BIN="$(command -v air)"
else
  GOPATH_DIR="$(go env GOPATH)"
  if [[ -x "$GOPATH_DIR/bin/air" ]]; then
    AIR_BIN="$GOPATH_DIR/bin/air"
  fi
fi

if [[ -z "$AIR_BIN" ]]; then
  echo "Air 未安装。先运行：./scripts/install-air.sh"
  exit 1
fi

echo "启动 Go API 热重载服务（Air）"
echo "后端目录：$BACKEND_DIR"
exec "$AIR_BIN" -c .air.toml
