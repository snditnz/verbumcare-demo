#!/bin/bash

# VerbumCare Auto-Start Setup Script (Cron-based)
# Sets up cron job to automatically start containers on reboot

echo "🔄 SETTING UP VERBUMCARE AUTO-START (CRON METHOD)"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVER="verbumcare-lab.local"

echo -e "${BLUE}📋 This method uses cron (no sudo required)${NC}"
echo ""

echo -e "${BLUE}🔧 Step 1: Setting Docker restart policies...${NC}"

# Set restart policies on the containers themselves
ssh $SERVER "docker update --restart=unless-stopped nagare-postgres nagare-backend nagare-nginx"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker restart policies set to 'unless-stopped'${NC}"
else
    echo -e "${YELLOW}⚠️  Could not set Docker restart policies${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Step 2: Adding cron job for startup...${NC}"

# Create a startup script
ssh $SERVER "cat > /home/q/verbumcare-startup.sh << 'EOF'
#!/bin/bash
# VerbumCare startup script
sleep 60  # Wait for system to fully boot
docker start nagare-postgres nagare-backend nagare-nginx
EOF"

# Make it executable
ssh $SERVER "chmod +x /home/q/verbumcare-startup.sh"

# Add to crontab
ssh $SERVER "(crontab -l 2>/dev/null; echo '@reboot /home/q/verbumcare-startup.sh >> /home/q/verbumcare-startup.log 2>&1') | crontab -"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Cron job added successfully${NC}"
else
    echo -e "${RED}❌ Failed to add cron job${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🧪 Step 3: Verifying cron setup...${NC}"

# Show current crontab
echo "Current crontab entries:"
ssh $SERVER "crontab -l | grep -E '(reboot|verbumcare)' || echo 'No VerbumCare cron jobs found'"

echo ""
echo -e "${GREEN}🎉 CRON AUTO-START SETUP COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📋 What happens now:${NC}"
echo "• Docker containers have 'unless-stopped' restart policy"
echo "• Cron job will start containers 60 seconds after reboot"
echo "• Containers will auto-restart if they crash"
echo "• No sudo required for this method"

echo ""
echo -e "${BLUE}🧪 Testing Instructions:${NC}"
echo "1. Reboot the server: ssh $SERVER 'sudo reboot'"
echo "2. Wait 2-3 minutes for boot + startup delay"
echo "3. Run: ./quick-server-status.sh"
echo "4. Check startup log: ssh $SERVER 'cat /home/q/verbumcare-startup.log'"

echo ""
echo -e "${BLUE}📋 Management Commands:${NC}"
echo "========================"
echo "View cron jobs:      ssh $SERVER 'crontab -l'"
echo "Remove cron job:     ssh $SERVER 'crontab -l | grep -v verbumcare | crontab -'"
echo "Check startup log:   ssh $SERVER 'cat /home/q/verbumcare-startup.log'"
echo "Manual startup:      ssh $SERVER '/home/q/verbumcare-startup.sh'"

echo ""
echo -e "${BLUE}🛡️  Reliability Features Added:${NC}"
echo "• ✅ Docker restart policies: Auto-restart crashed containers"
echo "• ✅ Cron @reboot: Starts containers after system boot"
echo "• ✅ Boot delay: 60-second wait for system stability"
echo "• ✅ Logging: Startup attempts logged to file"
echo "• ✅ No sudo required: Uses user-level cron"

exit 0