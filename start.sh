#!/bin/bash

# VerbumCare Demo Quick Start Script

set -e

echo "🏥 Starting VerbumCare Healthcare Documentation Demo"
echo "=================================================="

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file (you can edit this to add your OpenAI API key)"
fi

# Start services
echo "🚀 Starting database and backend services..."
docker compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Check health
echo "🔍 Checking service health..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health >/dev/null; then
        echo "✅ Backend API is ready!"
        break
    fi
    echo "   Waiting for backend... ($i/30)"
    sleep 2
done

# Display status
echo ""
echo "🎉 VerbumCare Demo is ready!"
echo ""
echo "📊 Services:"
echo "   • Backend API: http://localhost:3000"
echo "   • Health Check: http://localhost:3000/health"
echo "   • Database: localhost:5432 (demo/demo123)"
echo ""
echo "🧪 Test the API:"
echo "   curl http://localhost:3000/api/patients"
echo "   curl http://localhost:3000/api/dashboard/metrics"
echo ""
echo "📖 View logs:"
echo "   docker compose logs -f backend"
echo "   docker compose logs -f postgres"
echo ""
echo "🛑 Stop services:"
echo "   docker compose down"
echo ""
echo "For more information, see README.md"