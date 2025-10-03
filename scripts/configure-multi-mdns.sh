#!/bin/bash
# Configure Avahi to publish multiple .local hostnames
# - verbumcare-lab.local (server hostname)
# - nagare.local (product main)
# - nagare-api.local (API endpoint)
# - nagare-admin.local (admin portal)

set -e

if [ "$EUID" -ne 0 ]; then
    echo "⚠ This script requires sudo privileges"
    echo "Please run: sudo ./configure-multi-mdns.sh"
    exit 1
fi

echo "🌐 Configuring multiple mDNS hostnames for Nagare Edge Server"
echo "=============================================================="
echo ""

# Get the WiFi IP address
WIFI_IP=$(ip -4 addr show wlp3s0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}')

if [ -z "$WIFI_IP" ]; then
    echo "❌ Could not determine WiFi IP address"
    exit 1
fi

echo "WiFi IP address: $WIFI_IP"
echo ""

# Step 1: Set server hostname
echo "1️⃣ Setting server hostname to verbumcare-lab..."
hostnamectl set-hostname verbumcare-lab

# Step 2: Update /etc/hosts
echo "2️⃣ Updating /etc/hosts..."
cat > /etc/hosts <<EOF
127.0.0.1 localhost
127.0.1.1 verbumcare-lab

# IPv6
::1 localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

# Step 3: Configure Avahi to advertise verbumcare-lab.local
echo "3️⃣ Configuring Avahi daemon..."
cat > /etc/avahi/avahi-daemon.conf <<EOF
[server]
host-name=verbumcare-lab
domain-name=local
browse-domains=
use-ipv4=yes
use-ipv6=yes
allow-interfaces=wlp3s0
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

# Step 4: Create Avahi service files for additional hostnames
echo "4️⃣ Creating Avahi service files for nagare.local, nagare-api.local, nagare-admin.local..."

# Remove old service files
rm -f /etc/avahi/services/nagare*.service

# nagare.local - main entry point
cat > /etc/avahi/services/nagare.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Nagare Edge Server</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <host-name>nagare.local</host-name>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

# nagare-api.local - API endpoint
cat > /etc/avahi/services/nagare-api.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Nagare API Server</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <host-name>nagare-api.local</host-name>
    <txt-record>path=/api</txt-record>
  </service>
</service-group>
EOF

# nagare-admin.local - admin portal
cat > /etc/avahi/services/nagare-admin.service <<EOF
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>Nagare Admin Portal</name>
  <service>
    <type>_https._tcp</type>
    <port>443</port>
    <host-name>nagare-admin.local</host-name>
    <txt-record>path=/</txt-record>
  </service>
</service-group>
EOF

# Step 5: Restart Avahi
echo "5️⃣ Restarting Avahi daemon..."
systemctl restart avahi-daemon
sleep 3

# Step 6: Verify
echo ""
echo "✅ Configuration complete!"
echo ""
echo "Verifying mDNS hostnames:"
echo "========================="

for hostname in verbumcare-lab.local nagare.local nagare-api.local nagare-admin.local; do
    echo -n "  $hostname: "
    if avahi-resolve -n $hostname 2>/dev/null | grep -q "$WIFI_IP"; then
        echo "✓ Resolves to $WIFI_IP"
    else
        echo "⚠ Not resolving yet (may take a moment)"
    fi
done

echo ""
echo "Avahi services published:"
avahi-browse -a -t -r | grep -i nagare || echo "  (Services still initializing...)"

echo ""
echo "From other devices on the network, you can now access:"
echo "  • https://verbumcare-lab.local (server hostname)"
echo "  • https://nagare.local (main entry)"
echo "  • https://nagare-api.local (API endpoint)"
echo "  • https://nagare-admin.local (admin portal)"
echo ""
echo "Note: SSL certificates and nginx configs need to be updated to match these hostnames."
