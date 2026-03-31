#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/energy-ai}"
DATA_DIR="${DATA_DIR:-/var/lib/energy-ai}"
APP_PORT="${APP_PORT:-3000}"
SERVER_NAME="${SERVER_NAME:-_}"
if [ "${SERVER_NAME}" = "_" ]; then
  SERVER_NAMES="_";
else
  SERVER_NAMES="${SERVER_NAME} www.${SERVER_NAME}"
fi
NGINX_CONF_SRC="${NGINX_CONF_SRC:-${APP_DIR}/deploy/ec2-t3-micro/nginx.energy-ai.conf}"
NGINX_CONF_DST="/etc/nginx/conf.d/energy-ai.conf"

echo "[1/7] Updating packages"
sudo dnf update -y

echo "[2/7] Installing base packages"
sudo dnf install -y git nginx tar gzip

if ! command -v node >/dev/null 2>&1; then
  echo "[3/7] Installing Node.js 20"
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf install -y nodejs
else
  echo "[3/7] Node.js already installed: $(node -v)"
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[4/7] Installing PM2"
  sudo npm install -g pm2
else
  echo "[4/7] PM2 already installed: $(pm2 -v)"
fi

echo "[5/7] Creating app and data directories"
sudo mkdir -p "${APP_DIR}" "${DATA_DIR}"
sudo chown -R "${USER}:${USER}" "${APP_DIR}" "${DATA_DIR}"

if ! sudo swapon --show | grep -q .; then
  echo "[6/7] Creating 1G swap for safer builds on t3.micro"
  sudo fallocate -l 1G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
else
  echo "[6/7] Swap already configured"
fi

echo "[7/7] Configuring nginx and PM2 startup"
if [ -f "${NGINX_CONF_SRC}" ]; then
  sed \
    -e "s/__SERVER_NAMES__/${SERVER_NAMES}/g" \
    -e "s/__APP_PORT__/${APP_PORT}/g" \
    "${NGINX_CONF_SRC}" | sudo tee "${NGINX_CONF_DST}" >/dev/null
  sudo nginx -t
  sudo systemctl enable nginx
  sudo systemctl restart nginx
else
  echo "Skipping nginx config because ${NGINX_CONF_SRC} does not exist yet"
fi

sudo env PATH="${PATH}" pm2 startup systemd -u "${USER}" --hp "${HOME}"

cat <<EOF

Amazon Linux 2023 setup is ready.

Next:
1. Copy server/.env.ec2.example to server/.env and fill the real values
2. Run deploy/ec2-t3-micro/update-app.sh
3. Check curl http://127.0.0.1:${APP_PORT}/api/health
4. After DNS resolves, install certbot for HTTPS
EOF
