#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/energy-ai}"
DATA_DIR="${DATA_DIR:-/var/lib/energy-ai}"

cd "${APP_DIR}"

if [ ! -f "ecosystem.config.cjs" ]; then
  echo "ecosystem.config.cjs not found in ${APP_DIR}"
  exit 1
fi

mkdir -p "${DATA_DIR}"

echo "[1/5] Installing frontend dependencies"
npm ci --prefix client --include=dev

echo "[2/5] Installing server dependencies"
npm ci --prefix server

echo "[3/5] Building frontend"
npm run build --prefix client

echo "[4/5] Reloading PM2 app"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "[5/5] Deployment complete"
echo "Health check: curl http://127.0.0.1:3000/api/health"
