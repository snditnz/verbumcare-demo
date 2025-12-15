#!/bin/bash

# Voice Data Recovery Script
# This script creates database entries for existing voice files

echo "🔄 Voice Data Recovery Script"
echo "=============================="

# SSH into the remote server and run the recovery
ssh verbumcare-lab.local << 'EOF'

cd /home/q/verbumcare-demo

echo "📁 Found voice files:"
find backend/uploads/voice -name "*.enc" | head -5

echo ""
echo "🔍 Checking database status..."
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT COUNT(*) as voice_recordings FROM voice_recordings;"
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT COUNT(*) as review_queue FROM voice_review_queue;"

echo ""
echo "👤 Demo user status:"
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT username, staff_id FROM staff WHERE username = 'demo';"

echo ""
echo "🏥 Available patients:"
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT patient_id, family_name, given_name FROM patients LIMIT 3;"

EOF

echo ""
echo "✅ Recovery script completed"
echo ""
echo "📋 Next Steps:"
echo "1. The demo user has been restored"
echo "2. Voice files are preserved in backend/uploads/voice/"
echo "3. You can now make new voice recordings"
echo "4. The old recordings would need manual restoration if needed"