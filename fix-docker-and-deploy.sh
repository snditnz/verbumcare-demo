#!/bin/bash

echo "🔧 Fixing Docker Compose and deploying backend fixes..."

# SSH to remote server and fix docker-compose, then deploy
ssh verbumcare-lab.local << 'EOF'
cd /home/q/verbumcare-demo

echo "🐍 Installing missing Python distutils..."
sudo apt update && sudo apt install -y python3-distutils

echo "🐳 Using newer Docker Compose syntax..."
# Stop existing containers using direct docker commands
docker stop nagare-backend nagare-nginx nagare-postgres 2>/dev/null || true
docker rm nagare-backend nagare-nginx nagare-postgres 2>/dev/null || true

# Build and start using newer docker compose (without hyphen)
if docker compose version &> /dev/null; then
  echo "✅ Using 'docker compose' (newer syntax)"
  docker compose -f docker-compose.nagare.yml build backend
  docker compose -f docker-compose.nagare.yml up -d
else
  echo "❌ Docker Compose not available, trying manual container start..."
  
  # Manual container startup as fallback
  echo "🔄 Starting PostgreSQL..."
  docker run -d --name nagare-postgres \
    --network nagare-network \
    -e POSTGRES_DB=nagare_db \
    -e POSTGRES_USER=nagare \
    -e POSTGRES_PASSWORD=nagare_secure_password_change_me \
    -p 5432:5432 \
    -v postgres_data:/var/lib/postgresql/data \
    postgres:15-alpine

  echo "⏳ Waiting for PostgreSQL to start..."
  sleep 10

  echo "🏗️  Building backend image..."
  docker build -t verbumcare-backend ./backend/

  echo "🚀 Starting backend..."
  docker run -d --name nagare-backend \
    --network nagare-network \
    -e DATABASE_URL=postgres://nagare:nagare_secure_password_change_me@nagare-postgres:5432/nagare_db \
    -e NODE_ENV=production \
    -e WHISPER_URL=http://172.18.0.1:8080 \
    -e OLLAMA_URL=http://172.18.0.1:11434 \
    -v /home/q/verbumcare-demo/backend/uploads:/app/uploads \
    verbumcare-backend

  echo "🌐 Starting nginx..."
  docker run -d --name nagare-nginx \
    --network nagare-network \
    -p 80:80 -p 443:443 \
    -v /home/q/verbumcare-demo/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
    -v /home/q/verbumcare-demo/nginx/verbumcare-lab.local.conf:/etc/nginx/conf.d/verbumcare-lab.local.conf:ro \
    -v /home/q/verbumcare-demo/ssl/certs/nginx.crt:/etc/nginx/ssl/nginx.crt:ro \
    -v /home/q/verbumcare-demo/ssl/certs/nginx.key:/etc/nginx/ssl/nginx.key:ro \
    nginx:alpine
fi

echo "⏳ Waiting for services to start..."
sleep 20

echo "🔍 Checking service status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "🏥 Testing backend health..."
curl -k https://verbumcare-lab.local/api/health || echo "Backend not ready yet, checking logs..."

echo "📋 Backend logs:"
docker logs nagare-backend --tail 20

echo "✅ Deployment attempt complete!"
EOF

echo "🎉 Deployment script finished!"
echo ""
echo "Please run these commands to test:"
echo "1. curl -k 'https://verbumcare-lab.local/api/health'"
echo "2. curl -k 'https://verbumcare-lab.local/api/voice/review-queue/550e8400-e29b-41d4-a716-446655440105'"