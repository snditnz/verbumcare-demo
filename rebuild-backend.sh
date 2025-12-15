#!/bin/bash

echo "🔄 Rebuilding backend Docker image with latest changes..."

# SSH to remote server and rebuild the backend
ssh verbumcare-lab.local << 'EOF'
cd /home/q/verbumcare-demo

echo "📦 Stopping current backend..."
docker-compose stop backend

echo "🏗️  Rebuilding backend image..."
docker-compose build backend

echo "🚀 Starting backend with new image..."
docker-compose up -d backend

echo "⏳ Waiting for backend to start..."
sleep 10

echo "🔍 Checking backend health..."
curl -k https://verbumcare-lab.local/api/health || echo "Backend not ready yet"

echo "✅ Backend rebuild complete!"
EOF

echo "🎉 Backend has been rebuilt with the latest changes"
echo "📱 Please test a new voice recording to see if transcription works properly"