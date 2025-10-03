#!/bin/bash

# Nagare Edge Server - mDNS Setup
# Configures .nagare.local domains for LAN resolution

set -e

echo "🌐 Nagare mDNS Configuration"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠ This script requires sudo privileges${NC}"
    echo "Please run: sudo ./setup-mdns.sh"
    exit 1
fi

# Configuration
HOSTNAME="nagare"
DOMAIN_SUFFIX="nagare.local"

# Step 1: Install Avahi (if not installed)
echo "📦 Step 1: Installing Avahi mDNS daemon..."
if ! command -v avahi-daemon &> /dev/null; then
    apt-get update
    apt-get install -y avahi-daemon avahi-utils libnss-mdns
    echo -e "${GREEN}✓ Avahi installed${NC}"
else
    echo -e "${GREEN}✓ Avahi already installed${NC}"
fi
echo ""

# Step 2: Set hostname
echo "🏷️  Step 2: Configuring hostname..."
hostnamectl set-hostname "${HOSTNAME}"
echo -e "${GREEN}✓ Hostname set to: ${HOSTNAME}${NC}"
echo ""

# Step 3: Configure /etc/hosts
echo "📝 Step 3: Updating /etc/hosts..."
cat > /etc/hosts <<EOF
127.0.0.1 localhost
127.0.1.1 ${HOSTNAME} ${HOSTNAME}.${DOMAIN_SUFFIX}

# Nagare Edge Server subdomains
127.0.0.1 api.${DOMAIN_SUFFIX}
127.0.0.1 admin.${DOMAIN_SUFFIX}

# IPv6
::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

echo -e "${GREEN}✓ /etc/hosts updated${NC}"
echo ""

# Step 4: Configure Avahi daemon
echo "⚙️  Step 4: Configuring Avahi daemon..."
cat > /etc/avahi/avahi-daemon.conf <<EOF
[server]
host-name=${HOSTNAME}
domain-name=${DOMAIN_SUFFIX}
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

echo -e "${GREEN}✓ Avahi daemon configured${NC}"
echo ""

# Step 5: Create service files for subdomains
echo "📡 Step 5: Creating mDNS service files..."

# API service
cat > /etc/avahi/services/nagare-api.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Nagare API on %h</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <txt-record>path=/api</txt-record>
    <txt-record>product=Verbumcare Nagare</txt-record>
  </service>
</service-group>
EOF

# Admin service
cat > /etc/avahi/services/nagare-admin.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">Nagare Admin on %h</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <txt-record>path=/</txt-record>
    <txt-record>product=Verbumcare Nagare Admin</txt-record>
  </service>
</service-group>
EOF

echo -e "${GREEN}✓ mDNS service files created${NC}"
echo ""

# Step 6: Configure NSSwitch for mDNS resolution
echo "🔧 Step 6: Configuring NSSwitch..."
sed -i.bak 's/^hosts:.*/hosts:          files mdns4_minimal [NOTFOUND=return] dns mdns4/' /etc/nsswitch.conf
echo -e "${GREEN}✓ NSSwitch configured for mDNS${NC}"
echo ""

# Step 7: Restart Avahi
echo "🔄 Step 7: Restarting Avahi daemon..."
systemctl enable avahi-daemon
systemctl restart avahi-daemon

if systemctl is-active --quiet avahi-daemon; then
    echo -e "${GREEN}✓ Avahi daemon running${NC}"
else
    echo -e "${YELLOW}⚠ Avahi daemon failed to start${NC}"
    systemctl status avahi-daemon
    exit 1
fi
echo ""

# Step 8: Verify mDNS resolution
echo "🧪 Step 8: Verifying mDNS resolution..."
sleep 2

# Test resolution
if avahi-resolve -n ${HOSTNAME}.${DOMAIN_SUFFIX} &> /dev/null; then
    echo -e "${GREEN}✓ mDNS resolution working${NC}"
    avahi-resolve -n ${HOSTNAME}.${DOMAIN_SUFFIX}
else
    echo -e "${YELLOW}⚠ mDNS resolution test failed (may work after network restart)${NC}"
fi
echo ""

# Display summary
echo "============================"
echo -e "${GREEN}✅ mDNS Configuration Complete!${NC}"
echo "============================"
echo ""
echo "Server hostname: ${BLUE}${HOSTNAME}${NC}"
echo "Domain suffix: ${BLUE}${DOMAIN_SUFFIX}${NC}"
echo ""
echo "Available domains:"
echo "  • ${BLUE}${HOSTNAME}.${DOMAIN_SUFFIX}${NC}"
echo "  • ${BLUE}api.${DOMAIN_SUFFIX}${NC}"
echo "  • ${BLUE}admin.${DOMAIN_SUFFIX}${NC}"
echo ""
echo "Test resolution from this server:"
echo "  ${BLUE}ping ${HOSTNAME}.${DOMAIN_SUFFIX}${NC}"
echo "  ${BLUE}avahi-browse -a${NC}"
echo ""
echo "Test from other devices on LAN:"
echo "  ${BLUE}ping ${HOSTNAME}.${DOMAIN_SUFFIX}${NC}"
echo "  ${BLUE}curl https://api.${DOMAIN_SUFFIX}/health${NC}"
echo ""
echo "Note: Client devices need mDNS support:"
echo "  • iOS/macOS: Built-in (Bonjour)"
echo "  • Linux: Install avahi-daemon"
echo "  • Windows: Install Bonjour Print Services"
echo ""