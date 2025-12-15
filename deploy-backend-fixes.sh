#!/bin/bash

echo "🚀 Deploying backend fixes to remote server..."

# Step 1: Copy the entire project structure to remote server
echo "📦 Copying project files to remote server..."
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'ipad-app/node_modules' \
  ./ verbumcare-lab.local:/home/q/verbumcare-demo-new/

# Step 2: SSH to remote server and set up deployment
ssh verbumcare-lab.local << 'EOF'
cd /home/q

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker stop nagare-backend nagare-nginx nagare-postgres 2>/dev/null || true

# Backup existing setup
if [ -d "verbumcare-demo-backup" ]; then
  rm -rf verbumcare-demo-backup
fi
if [ -d "verbumcare-demo" ]; then
  mv verbumcare-demo verbumcare-demo-backup
fi

# Move new deployment into place
mv verbumcare-demo-new verbumcare-demo
cd verbumcare-demo

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << 'ENVEOF'
POSTGRES_PASSWORD=nagare_secure_password_change_me
NODE_ENV=production
WHISPER_URL=http://172.18.0.1:8080
WHISPER_MODEL=medium
OLLAMA_URL=http://172.18.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_THREAD=8
OLLAMA_TEMPERATURE=0.1
EDGE_SERVER_NAME=Nagare Demo
CLOUD_SYNC_ENABLED=false
ENVEOF
fi

# Use the nagare docker-compose file
echo "🐳 Starting Docker services with docker-compose.nagare.yml..."

# Try different docker-compose commands
if command -v docker-compose &> /dev/null; then
  echo "Using docker-compose..."
  docker-compose -f docker-compose.nagare.yml down --remove-orphans 2>/dev/null || true
  docker-compose -f docker-compose.nagare.yml build backend
  docker-compose -f docker-compose.nagare.yml up -d
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
  echo "Using docker compose..."
  docker compose -f docker-compose.nagare.yml down --remove-orphans 2>/dev/null || true
  docker compose -f docker-compose.nagare.yml build backend
  docker compose -f docker-compose.nagare.yml up -d
else
  echo "❌ Neither docker-compose nor docker compose found!"
  exit 1
fi

echo "⏳ Waiting for services to start..."
sleep 15

echo "🔍 Checking service status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "🏥 Testing backend health..."
curl -k https://verbumcare-lab.local/api/health || echo "Backend not ready yet"

echo "✅ Deployment complete!"
EOF

echo "🎉 Backend deployment finished!"
echo ""
echo "Next steps:"
echo "1. Test the API: curl -k 'https://verbumcare-lab.local/api/voice/review-queue/550e8400-e29b-41d4-a716-446655440105'"
echo "2. Make a new voice recording to test transcription"
echo "3. Check if duration field now appears correctly"