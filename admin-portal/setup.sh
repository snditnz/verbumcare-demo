#!/bin/bash

# VerbumCare Admin Portal Setup Script

set -e

echo "🏥 Setting up VerbumCare Admin Portal"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    cat > .env << EOF
VITE_API_URL=http://localhost:3000/api
EOF
    echo "✅ Created .env file"
else
    echo "✅ Environment file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "🎉 Admin Portal setup complete!"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""
echo "📊 The admin portal will be available at:"
echo "   http://localhost:5173"
echo ""
echo "🔗 Make sure the backend API is running at:"
echo "   http://localhost:3000"
echo ""
echo "📚 Features available:"
echo "   • Dashboard with real-time metrics"
echo "   • Patient management (CRUD operations)"
echo "   • Staff administration"
echo "   • Medication order management"
echo "   • Reports and HL7/SS-MIX2 exports"
echo "   • Multi-language support (EN/JA/ZH-TW)"
echo ""
echo "🌐 Test the language switcher in the top-right corner!"