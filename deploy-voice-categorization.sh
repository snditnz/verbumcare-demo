#!/bin/bash

# Deploy Voice Categorization Feature to Remote Server
# This script deploys the voice categorization feature to verbumcare-lab.local

set -e

echo "🚀 Deploying Voice Categorization Feature..."

# Configuration
REMOTE_HOST="verbumcare-lab.local"
REMOTE_PROJECT_PATH="/home/q/verbumcare-demo"  # Adjust this path as needed
LOCAL_BACKEND_PATH="./backend"

echo "📦 Step 1: Copying backend files to remote server..."

# Copy updated backend files
rsync -avz --progress \
  --include="src/routes/voice.js" \
  --include="src/services/categorizationService.js" \
  --include="src/services/reviewQueueService.js" \
  --include="src/services/reviewDataInsertion.js" \
  --include="src/db/migrations/010_*.sql" \
  --include="src/db/migrations/011_*.sql" \
  --include="src/db/migrations/012_*.sql" \
  --exclude="node_modules/" \
  --exclude="uploads/" \
  --exclude="**/__tests__/" \
  ${LOCAL_BACKEND_PATH}/ ${REMOTE_HOST}:${REMOTE_PROJECT_PATH}/backend/

echo "🔄 Step 2: Rebuilding and restarting backend container..."

# SSH into remote server and rebuild/restart
ssh ${REMOTE_HOST} << 'EOF'
cd /home/q/verbumcare-demo

# Stop the backend container
docker stop nagare-backend || true

# Rebuild the backend image
docker-compose build backend

# Start the backend container
docker-compose up -d backend

# Wait for container to be ready
echo "⏳ Waiting for backend to start..."
sleep 10

# Check if container is running
if docker ps | grep -q nagare-backend; then
    echo "✅ Backend container is running"
else
    echo "❌ Backend container failed to start"
    docker logs nagare-backend --tail 20
    exit 1
fi
EOF

echo "🗃️  Step 3: Running database migrations..."

# Run the voice categorization migrations
ssh ${REMOTE_HOST} << 'EOF'
cd /home/q/verbumcare-demo

# Run migrations for voice categorization
echo "Running migration 010..."
docker exec nagare-backend node src/db/run-migration.js 010

echo "Running migration 011..."
docker exec nagare-backend node src/db/run-migration.js 011

echo "Running migration 012..."
docker exec nagare-backend node src/db/run-migration.js 012

echo "✅ All migrations completed"
EOF

echo "🧪 Step 4: Testing the deployment..."

# Test the new endpoint
echo "Testing review queue endpoint..."
if ssh ${REMOTE_HOST} "docker exec nagare-backend wget -q -O - http://localhost:3000/api/voice/review-queue/test-user-id" | grep -q "success"; then
    echo "✅ Voice categorization API is responding correctly"
else
    echo "⚠️  API test returned unexpected response (this may be normal for empty queue)"
fi

echo ""
echo "🎉 Voice Categorization Feature Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Test the iPad app - the 404 error should be resolved"
echo "2. Try recording a voice note to test the full workflow"
echo "3. Check the review queue in the app"
echo ""
echo "🔍 Troubleshooting:"
echo "- Check backend logs: ssh ${REMOTE_HOST} 'docker logs nagare-backend --tail 50'"
echo "- Check database: ssh ${REMOTE_HOST} 'docker exec nagare-postgres psql -U nagare -d nagare_db -c \"\\dt\"'"
echo "- Test API directly: curl -k https://verbumcare-lab.local/api/voice/review-queue/YOUR_USER_ID"