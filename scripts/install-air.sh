#!/usr/bin/env bash
set -euo pipefail

if ! command -v go >/dev/null 2>&1; then
  echo "未找到 Go，请先安装 Go。"
  exit 1
fi

GOPATH_DIR="$(go env GOPATH)"
if command -v air >/dev/null 2>&1; then
  echo "Air 已安装：$(command -v air)"
elif [[ -x "$GOPATH_DIR/bin/air" ]]; then
  echo "Air 已安装：$GOPATH_DIR/bin/air"
else
  echo "正在安装 Air..."
  go install github.com/air-verse/air@latest
  echo "Air 已安装到 $GOPATH_DIR/bin/air"
fi

if [[ ":$PATH:" != *":$GOPATH_DIR/bin:"* ]]; then
  echo "提示：$GOPATH_DIR/bin 不在 PATH 中；启动脚本会自动查找该位置。"
fi
