#!/bin/bash

# VerbumCare Auto-Start Setup Script (Interactive)
# Sets up systemd service to automatically start containers on reboot

echo "🔄 SETTING UP VERBUMCARE AUTO-START ON REBOOT"
echo "============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVER="verbumcare-lab.local"

echo -e "${BLUE}📋 This script will set up automatic startup for VerbumCare${NC}"
echo "You will be prompted for the sudo password on the server."
echo ""

echo -e "${BLUE}🔧 Step 1: Creating systemd service file...${NC}"
echo "Please enter the sudo password when prompted:"

# Create the service file with interactive sudo
ssh -t $SERVER "sudo tee /etc/systemd/system/verbumcare.service > /dev/null << 'EOF'
[Unit]
Description=VerbumCare Healthcare Platform
Requires=docker.service
After=docker.service
StartLimitIntervalSec=0

[Service]
Type=oneshot
RemainAfterExit=yes
User=q
Group=q
WorkingDirectory=/home/q/verbumcare-demo
ExecStart=/usr/bin/docker start nagare-postgres nagare-backend nagare-nginx
ExecStop=/usr/bin/docker stop nagare-postgres nagare-backend nagare-nginx
TimeoutStartSec=300
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Service file created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create service file${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔧 Step 2: Enabling the service...${NC}"

# Reload systemd and enable the service
ssh -t $SERVER "sudo systemctl daemon-reload && sudo systemctl enable verbumcare.service"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ VerbumCare service enabled for auto-start${NC}"
else
    echo -e "${RED}❌ Failed to enable service${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🧪 Step 3: Testing the service...${NC}"

# Test the service status
ssh -t $SERVER "sudo systemctl status verbumcare.service --no-pager"

echo ""
echo -e "${BLUE}🔄 Step 4: Setting Docker restart policies...${NC}"

# Set restart policies on the containers themselves as backup
ssh $SERVER "docker update --restart=unless-stopped nagare-postgres nagare-backend nagare-nginx"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker restart policies set to 'unless-stopped'${NC}"
else
    echo -e "${YELLOW}⚠️  Could not set Docker restart policies (containers may not be running)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 AUTO-START SETUP COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📋 What happens now:${NC}"
echo "• VerbumCare will automatically start after server reboot"
echo "• Containers will restart if they crash (unless manually stopped)"
echo "• Service starts after Docker is ready"
echo "• 5-minute timeout for startup (handles slow boot)"
echo "• Automatic restart on failure with 30-second delay"

echo ""
echo -e "${BLUE}🧪 Testing Instructions:${NC}"
echo "1. Test the service: ssh -t $SERVER 'sudo systemctl start verbumcare.service'"
echo "2. Check status: ssh -t $SERVER 'sudo systemctl status verbumcare.service'"
echo "3. Reboot test: ssh -t $SERVER 'sudo reboot'"
echo "4. After reboot: ./quick-server-status.sh"

echo ""
echo -e "${BLUE}📋 Service Management Commands:${NC}"
echo "================================"
echo "Check status:    ssh -t $SERVER 'sudo systemctl status verbumcare.service'"
echo "Start manually:  ssh -t $SERVER 'sudo systemctl start verbumcare.service'"
echo "Stop manually:   ssh -t $SERVER 'sudo systemctl stop verbumcare.service'"
echo "Restart:         ssh -t $SERVER 'sudo systemctl restart verbumcare.service'"
echo "View logs:       ssh -t $SERVER 'sudo journalctl -u verbumcare.service -f'"
echo "Disable:         ssh -t $SERVER 'sudo systemctl disable verbumcare.service'"

echo ""
echo -e "${BLUE}🛡️  Reliability Features Added:${NC}"
echo "• ✅ Systemd service: Starts containers on boot"
echo "• ✅ Docker restart policies: Restarts crashed containers"
echo "• ✅ Service restart: Retries failed startups"
echo "• ✅ Dependency management: Waits for Docker to be ready"
echo "• ✅ Timeout protection: 5-minute startup window"
echo "• ✅ Failure recovery: 30-second restart delay"

exit 0