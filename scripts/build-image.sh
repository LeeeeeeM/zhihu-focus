#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .docker-build
(cd backend && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -o ../.docker-build/zhihu-focus ./server)
(cd frontend && VITE_BASE_PATH=/zh/ pnpm build)
rm -rf .docker-build/frontend
mkdir -p .docker-build/frontend
cp -R frontend/dist/. .docker-build/frontend/
if [[ -f /etc/ssl/cert.pem ]]; then
  cp /etc/ssl/cert.pem .docker-build/ca-certificates.crt
else
  cp /etc/ssl/certs/ca-certificates.crt .docker-build/ca-certificates.crt
fi
docker compose build
