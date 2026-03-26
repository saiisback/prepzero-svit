#!/bin/bash
set -euo pipefail

# PrepZero EC2 Deployment
# Target: Ubuntu 22.04+ | Domain: svit.prepzer0.co.in

DOMAIN="svit.prepzer0.co.in"
APP_DIR="/opt/prepzero"
EMAIL="nitishsah9845@gmail.com"

echo "=== PrepZero Deployment ==="

# ── 1. Install Docker if missing ──
if ! command -v docker &> /dev/null; then
  echo "[1] Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Log out and back in, then re-run this script."
  exit 0
fi

if ! docker compose version &> /dev/null; then
  echo "[1] Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin
fi

echo "[1] Docker ready."

# ── 2. Setup app directory ──
echo "[2] Setting up $APP_DIR..."
if [ ! -d "$APP_DIR" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  echo "Created $APP_DIR. Copy your project files here and re-run."
  exit 0
fi
cd "$APP_DIR"

# ── 3. Check .env ──
if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill in values."
  exit 1
fi
echo "[3] .env found."

# ── 4. Add swap if < 4GB RAM ──
TOTAL_MEM=$(free -m | awk '/Mem:/ {print $2}')
if [ "$TOTAL_MEM" -lt 4000 ] && [ ! -f /swapfile ]; then
  echo "[4] Adding 2GB swap (low memory detected: ${TOTAL_MEM}MB)..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
  echo "[4] Memory OK (${TOTAL_MEM}MB)."
fi

# ── 5. Build & start (HTTP first for Certbot) ──
echo "[5] Building and starting services..."
mkdir -p nginx/conf.d

# HTTP-only nginx config for initial SSL setup
cat > nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name svit.prepzer0.co.in;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://nextjs:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
EOF

docker compose up -d --build
echo "Waiting for services to start..."
sleep 10

# ── 6. SSL certificate ──
echo "[6] Obtaining SSL certificate for $DOMAIN..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Switch to HTTPS config
cat > nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name svit.prepzer0.co.in;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name svit.prepzer0.co.in;

    ssl_certificate /etc/letsencrypt/live/svit.prepzer0.co.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/svit.prepzer0.co.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    client_max_body_size 50M;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://nextjs:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /_next/static/ {
        proxy_pass http://nextjs:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://nextjs:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

docker compose exec nginx nginx -s reload
echo "[6] SSL configured."

# ── 7. Cron job for test notifications ──
echo "[7] Setting up cron..."
CRON_SECRET=$(grep -E '^CRON_SECRET=' .env | cut -d '=' -f2 | tr -d ' "'"'"'')

(crontab -l 2>/dev/null | grep -v "prepzero-cron" ; \
  echo "*/5 * * * * curl -sf -H 'Authorization: Bearer ${CRON_SECRET}' http://localhost:3000/api/cron/test-notifications > /dev/null 2>&1 # prepzero-cron" ; \
  echo "0 3 * * * docker compose -f ${APP_DIR}/docker-compose.yml exec -T nginx nginx -s reload > /dev/null 2>&1 # prepzero-cron-ssl-reload" \
) | crontab -

echo ""
echo "=== Deployment Complete ==="
echo "Site:  https://$DOMAIN"
echo "Cron:  every 5 min -> test notifications"
echo ""
echo "Commands:"
echo "  docker compose logs -f nextjs     # App logs"
echo "  docker compose logs -f nginx      # Nginx logs"
echo "  docker compose restart nextjs     # Restart app"
echo "  docker compose up -d --build      # Rebuild & restart"
