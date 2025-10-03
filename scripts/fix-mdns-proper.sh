#!/bin/bash
# Fix mDNS configuration properly
# Server hostname: verbumcare-lab
# mDNS advertised: nagare.local, api.nagare.local, admin.nagare.local

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠ This script requires sudo privileges"
    echo "Please run: sudo ./fix-mdns-proper.sh"
    exit 1
fi

HOSTNAME="verbumcare-lab"

echo "🔧 Fixing mDNS configuration..."
echo ""

# Step 1: Restore proper hostname
echo "1️⃣ Restoring hostname to: ${HOSTNAME}"
hostnamectl set-hostname "${HOSTNAME}"

# Step 2: Update /etc/hosts
echo "2️⃣ Updating /etc/hosts..."
cat > /etc/hosts <<EOF
127.0.0.1 localhost
127.0.1.1 ${HOSTNAME}

# Nagare Edge Server subdomains (for local resolution)
127.0.0.1 nagare.local
127.0.0.1 api.nagare.local
127.0.0.1 admin.nagare.local

# IPv6
::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

# Step 3: Configure Avahi to advertise nagare.local
echo "3️⃣ Configuring Avahi to advertise nagare.local..."
cat > /etc/avahi/avahi-daemon.conf <<EOF
[server]
host-name=nagare
domain-name=local
browse-domains=
use-ipv4=yes
use-ipv6=yes
allow-interfaces=
deny-interfaces=
check-response-ttl=no
use-iff-running=no
enable-dbus=yes
disallow-other-stacks=no

[wide-area]
enable-wide-area=yes

[publish]
disable-publishing=no
disable-user-service-publishing=no
add-service-cookie=no
publish-addresses=yes
publish-hinfo=yes
publish-workstation=yes
publish-domain=yes
publish-dns-servers=
publish-resolv-conf-dns-servers=no
publish-aaaa-on-ipv4=yes
publish-a-on-ipv6=no

[reflector]
enable-reflector=no
reflect-ipv=no

[rlimits]
rlimit-core=0
rlimit-data=4194304
rlimit-fsize=0
rlimit-nofile=768
rlimit-stack=4194304
rlimit-nproc=3
EOF

# Step 4: Create service files for nagare subdomains
echo "4️⃣ Creating mDNS service files..."

# Main nagare.local service
cat > /etc/avahi/services/nagare.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Nagare Edge Server</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
    <txt-record>path=/</txt-record>
  </service>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

# Step 5: Restart Avahi
echo "5️⃣ Restarting Avahi daemon..."
systemctl restart avahi-daemon

# Wait for Avahi to start
sleep 3

# Step 6: Verify
echo ""
echo "✅ Configuration complete!"
echo ""
echo "Server hostname: $(hostname)"
echo "Advertised mDNS name: nagare.local"
echo ""
echo "Avahi status:"
systemctl status avahi-daemon --no-pager | head -10
echo ""
echo "Testing mDNS..."
avahi-resolve -n nagare.local 2>/dev/null || echo "⚠ nagare.local not resolving yet (may take a moment)"
echo ""
echo "From other devices, you should be able to access:"
echo "  • nagare.local"
echo "  • api.nagare.local (via nginx)"
echo "  • admin.nagare.local (via nginx)"
echo ""
echo "Note: Subdomains (api/admin) are handled by nginx, not separate mDNS entries"
