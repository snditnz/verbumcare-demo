#!/bin/bash

# VerbumCare Mac Mini Auto-Start Setup Script
# Sets up launchd service to automatically start containers on boot/login

echo "🔄 SETTING UP VERBUMCARE AUTO-START ON MAC MINI"
echo "==============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MAC_MINI="vcadmin@verbumcaremac-mini"

echo -e "${BLUE}📋 Creating startup script...${NC}"

# Create the startup script on the Mac Mini
ssh $MAC_MINI "cat > ~/verbumcare-startup.sh << 'EOF'
#!/bin/bash

# VerbumCare Mac Mini Startup Script
# Starts Docker containers after boot

LOG_FILE=\"\$HOME/verbumcare-startup.log\"
COMPOSE_FILE=\"\$HOME/verbumcare-demo/docker-compose.macmini.yml\"

# Function to log with timestamp
log() {
    echo \"\$(date '+%Y-%m-%d %H:%M:%S') - \$1\" >> \"\$LOG_FILE\"
}

log \"=== VerbumCare Startup Script Started ===\"

# Wait for Docker to be ready
log \"Waiting for Docker to be ready...\"
for i in {1..30}; do
    if /Applications/Docker.app/Contents/Resources/bin/docker info >/dev/null 2>&1; then
        log \"Docker is ready after \$i attempts\"
        break
    fi
    if [ \$i -eq 30 ]; then
        log \"ERROR: Docker not ready after 30 attempts\"
        exit 1
    fi
    sleep 2
done

# Change to the application directory
cd \"\$HOME/verbumcare-demo\" || {
    log \"ERROR: Could not change to verbumcare-demo directory\"
    exit 1
}

# Set Docker path
export PATH=\"/Applications/Docker.app/Contents/Resources/bin:\$PATH\"

log \"Starting VerbumCare containers...\"

# Start containers using docker compose
if docker compose -f docker-compose.macmini.yml up -d; then
    log \"SUCCESS: VerbumCare containers started successfully\"
    
    # Wait for services to be ready
    log \"Waiting for services to be ready...\"
    sleep 30
    
    # Check if services are responding
    if curl -k -s https://localhost/health >/dev/null 2>&1; then
        log \"SUCCESS: VerbumCare is fully operational\"
    else
        log \"WARNING: VerbumCare containers started but health check failed\"
    fi
else
    log \"ERROR: Failed to start VerbumCare containers\"
    exit 1
fi

log \"=== VerbumCare Startup Script Completed ===\"
EOF"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Startup script created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create startup script${NC}"
    exit 1
fi

# Make the script executable
ssh $MAC_MINI "chmod +x ~/verbumcare-startup.sh"

echo ""
echo -e "${BLUE}🔧 Creating LaunchAgent plist...${NC}"

# Create the LaunchAgent plist file
ssh $MAC_MINI "mkdir -p ~/Library/LaunchAgents"
ssh $MAC_MINI "cat > ~/Library/LaunchAgents/com.verbumcare.startup.plist << 'EOF'
<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
    <key>Label</key>
    <string>com.verbumcare.startup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/vcadmin/verbumcare-startup.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/Users/vcadmin/verbumcare-launchd.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/vcadmin/verbumcare-launchd.log</string>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>ThrottleInterval</key>
    <integer>60</integer>
</dict>
</plist>
EOF"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ LaunchAgent plist created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create LaunchAgent plist${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 Loading LaunchAgent...${NC}"

# Load the LaunchAgent
ssh $MAC_MINI "launchctl load ~/Library/LaunchAgents/com.verbumcare.startup.plist"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ LaunchAgent loaded successfully${NC}"
else
    echo -e "${YELLOW}⚠️  LaunchAgent load may have failed, but this is sometimes normal${NC}"
fi

echo ""
echo -e "${BLUE}🧪 Testing the startup script...${NC}"

# Test the startup script manually
echo "Running startup script test..."
ssh $MAC_MINI "~/verbumcare-startup.sh"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Startup script test completed${NC}"
else
    echo -e "${YELLOW}⚠️  Startup script test had issues (check logs)${NC}"
fi

echo ""
echo -e "${BLUE}📋 Verifying Docker restart policies...${NC}"

# Verify Docker restart policies are set
restart_policies=$(ssh $MAC_MINI "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && docker inspect macmini-postgres macmini-backend macmini-nginx --format '{{.Name}}: {{.HostConfig.RestartPolicy.Name}}' 2>/dev/null")

if [[ "$restart_policies" == *"unless-stopped"* ]]; then
    echo -e "${GREEN}✅ Docker restart policies are properly configured${NC}"
    echo "$restart_policies"
else
    echo -e "${YELLOW}⚠️  Setting Docker restart policies...${NC}"
    ssh $MAC_MINI "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml up -d"
fi

echo ""
echo -e "${GREEN}🎉 MAC MINI AUTO-START SETUP COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📋 What happens now:${NC}"
echo "• VerbumCare will automatically start when vcadmin user logs in"
echo "• LaunchAgent runs every 5 minutes to ensure containers are running"
echo "• Docker restart policies ensure containers restart if they crash"
echo "• All startup activity is logged for troubleshooting"

echo ""
echo -e "${BLUE}🧪 Testing Instructions:${NC}"
echo "1. Reboot the Mac Mini: ssh $MAC_MINI 'sudo reboot'"
echo "2. Wait 3-4 minutes for boot and auto-login"
echo "3. Check status: ssh $MAC_MINI 'export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && docker ps'"
echo "4. Test API: ssh $MAC_MINI 'curl -k -s https://localhost/health'"

echo ""
echo -e "${BLUE}📋 Management Commands:${NC}"
echo "================================"
echo "Check LaunchAgent status: ssh $MAC_MINI 'launchctl list | grep verbumcare'"
echo "View startup logs:        ssh $MAC_MINI 'cat ~/verbumcare-startup.log'"
echo "View LaunchAgent logs:    ssh $MAC_MINI 'cat ~/verbumcare-launchd.log'"
echo "Manual startup test:      ssh $MAC_MINI '~/verbumcare-startup.sh'"
echo "Unload LaunchAgent:       ssh $MAC_MINI 'launchctl unload ~/Library/LaunchAgents/com.verbumcare.startup.plist'"
echo "Reload LaunchAgent:       ssh $MAC_MINI 'launchctl load ~/Library/LaunchAgents/com.verbumcare.startup.plist'"

echo ""
echo -e "${BLUE}🛡️  Reliability Features:${NC}"
echo "• LaunchAgent: Starts containers on user login"
echo "• Periodic check: Runs every 5 minutes to ensure containers are running"
echo "• Docker restart policies: Restarts crashed containers automatically"
echo "• Comprehensive logging: All startup attempts logged"
echo "• Throttling: 60-second minimum between restart attempts"

echo ""
echo -e "${BLUE}📝 Important Notes:${NC}"
echo "• Auto-start requires vcadmin user to be logged in (or auto-login enabled)"
echo "• For true boot-time startup, enable auto-login in System Preferences"
echo "• LaunchAgent runs in user context (no sudo required)"
echo "• Docker Desktop must be configured to start automatically"

exit 0