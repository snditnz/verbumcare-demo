#!/bin/bash

# Deploy Multi-Hostname SSL Certificate to Mac Mini
# This script deploys the generated SSL certificate with SANs to the Mac Mini

set -e

MAC_MINI_HOST="verbumcarenomac-mini.local"
MAC_MINI_USER="vcadmin"
CERT_FILE="nginx-multi.crt"
KEY_FILE="nginx-multi.key"

echo "🔐 Deploying Multi-Hostname SSL Certificate to Mac Mini"
echo "=================================================="

# Check if certificate files exist
if [[ ! -f "$CERT_FILE" ]]; then
    echo "❌ Certificate file $CERT_FILE not found!"
    exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
    echo "❌ Key file $KEY_FILE not found!"
    exit 1
fi

echo "✅ Certificate files found"
echo "📋 Certificate details:"
openssl x509 -in "$CERT_FILE" -text -noout | grep -A5 "Subject Alternative Name"

echo ""
echo "🚀 Deploying to Mac Mini..."

# Copy certificate files to Mac Mini
echo "📤 Copying certificate files..."
scp "$CERT_FILE" "$KEY_FILE" "$MAC_MINI_USER@$MAC_MINI_HOST:~/verbumcare-demo/ssl/certs/"

# SSH into Mac Mini and deploy certificate
echo "🔧 Deploying certificate on Mac Mini..."
ssh "$MAC_MINI_USER@$MAC_MINI_HOST" << 'EOF'
cd ~/verbumcare-demo

# Backup existing certificates
echo "💾 Backing up existing certificates..."
if [[ -f ssl/certs/nginx.crt ]]; then
    cp ssl/certs/nginx.crt ssl/certs/nginx.crt.backup.$(date +%Y%m%d_%H%M%S)
fi
if [[ -f ssl/certs/nginx.key ]]; then
    cp ssl/certs/nginx.key ssl/certs/nginx.key.backup.$(date +%Y%m%d_%H%M%S)
fi

# Install new certificates
echo "📦 Installing new certificates..."
mv ssl/certs/nginx-multi.crt ssl/certs/nginx.crt
mv ssl/certs/nginx-multi.key ssl/certs/nginx.key

# Set proper permissions
chmod 644 ssl/certs/nginx.crt
chmod 600 ssl/certs/nginx.key

# Check if Docker services are running
echo "🐳 Checking Docker services..."
export PATH=/Applications/Docker.app/Contents/Resources/bin:$PATH

if ! docker ps | grep -q macmini-nginx; then
    echo "⚠️  nginx container not running, starting services..."
    docker compose -f docker-compose.macmini.yml up -d
else
    echo "🔄 Restarting nginx container..."
    docker compose -f docker-compose.macmini.yml restart nginx
fi

# Wait for nginx to start
sleep 5

# Check nginx status
echo "🔍 Checking nginx status..."
docker compose -f docker-compose.macmini.yml ps nginx

# Test local endpoint
echo "🧪 Testing local endpoint..."
curl -k -s https://localhost/health || echo "⚠️  Local endpoint test failed"

echo "✅ Certificate deployment complete!"
EOF

echo ""
echo "🧪 Testing connectivity from local machine..."

# Test all hostname variants
echo "Testing verbumcarenomac-mini.local..."
if curl -k --connect-timeout 10 -s "https://verbumcarenomac-mini.local/health" > /dev/null; then
    echo "✅ verbumcarenomac-mini.local - SUCCESS"
else
    echo "❌ verbumcarenomac-mini.local - FAILED"
fi

echo "Testing verbumcaremac-mini..."
if curl -k --connect-timeout 10 -s "https://verbumcaremac-mini/health" > /dev/null; then
    echo "✅ verbumcaremac-mini - SUCCESS"
else
    echo "❌ verbumcaremac-mini - FAILED"
fi

echo "Testing verbumcaremac-mini.tail609750.ts.net..."
if curl -k --connect-timeout 10 -s "https://verbumcaremac-mini.tail609750.ts.net/health" > /dev/null; then
    echo "✅ verbumcaremac-mini.tail609750.ts.net - SUCCESS"
else
    echo "❌ verbumcaremac-mini.tail609750.ts.net - FAILED"
fi

echo ""
echo "🎉 SSL Certificate Deployment Complete!"
echo "=================================================="
echo "Certificate includes SANs for:"
echo "  - verbumcarenomac-mini.local (mDNS)"
echo "  - verbumcaremac-mini (short hostname)"
echo "  - verbumcaremac-mini.tail609750.ts.net (Tailscale)"
echo "  - localhost (local testing)"
echo "  - 127.0.0.1 (IP address)"
echo ""
echo "Next steps:"
echo "1. Test iOS Settings > VerbumCare > Mac Mini"
echo "2. Verify app connects successfully"
echo "3. Check connection status in app settings"
