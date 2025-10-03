#!/bin/bash
# Fix Avahi hostname resolution by using /etc/avahi/hosts
# This explicitly publishes A records for all our .local hostnames

set -e

if [ "$EUID" -ne 0 ]; then
    echo "⚠ This script requires sudo privileges"
    echo "Please run: sudo ./fix-avahi-hosts.sh"
    exit 1
fi

echo "🔧 Fixing Avahi hostname resolution"
echo "===================================="
echo ""

# Get WiFi IP
WIFI_IP=$(ip -4 addr show wlp3s0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

if [ -z "$WIFI_IP" ]; then
    echo "❌ Could not determine WiFi IP address"
    exit 1
fi

echo "WiFi IP: $WIFI_IP"
echo ""

# Create /etc/avahi/hosts with all our hostnames
echo "📝 Creating /etc/avahi/hosts..."
cat > /etc/avahi/hosts <<EOF
# Nagare Edge Server - Hostname to IP mappings
# These will be published as mDNS A records
$WIFI_IP nagare.local
$WIFI_IP nagare-api.local
$WIFI_IP nagare-admin.local
EOF

echo "✓ Created /etc/avahi/hosts"
echo ""

# Restart Avahi to pick up the changes
echo "🔄 Restarting Avahi daemon..."
systemctl restart avahi-daemon
sleep 3

echo "✓ Avahi restarted"
echo ""

# Verify locally
echo "🧪 Testing local resolution:"
echo "============================"

for hostname in nagare.local nagare-api.local nagare-admin.local; do
    echo -n "  $hostname: "
    if avahi-resolve -n $hostname 2>/dev/null | grep -q "$WIFI_IP"; then
        echo "✓ Resolves to $WIFI_IP"
    else
        echo "⚠ Not resolving"
    fi
done

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Test from Mac:"
echo "  dns-sd -G v4 nagare-api.local"
echo "  ping nagare-api.local"
