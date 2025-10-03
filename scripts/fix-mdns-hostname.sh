#!/bin/bash
# Fix mDNS hostname collision issue
# Changes hostname from 'nagare' to 'nagare-server' to prevent 'nagare.nagare.local'

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠ This script requires sudo privileges"
    echo "Please run: sudo ./fix-mdns-hostname.sh"
    exit 1
fi

HOSTNAME="nagare-server"
DOMAIN_SUFFIX="nagare.local"

echo "🔧 Fixing mDNS hostname collision..."
echo ""

# Step 1: Set new hostname
echo "1️⃣ Setting hostname to: ${HOSTNAME}"
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

# Step 3: Update Avahi configuration
echo "3️⃣ Updating Avahi daemon config..."
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

# Step 4: Add CNAME aliases
echo "4️⃣ Adding CNAME aliases for subdomains..."
cat > /etc/avahi/services/nagare-cname.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Nagare Edge Server</name>
  <service>
    <type>_http._tcp</type>
    <port>80</port>
  </service>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
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
echo "Testing mDNS resolution..."
avahi-browse -a -t -r | grep -i nagare || true
echo ""
echo "Hostname: $(hostname)"
echo "FQDN: $(hostname -f)"
echo ""
echo "Test from other devices:"
echo "  ping nagare.local"
echo "  ping api.nagare.local"
echo "  ping admin.nagare.local"
echo ""
echo "If ping doesn't work, the devices will need /etc/hosts entries or wait for DNS cache to clear"
