#!/bin/bash

# Fix Duration Data Script
# Updates voice recordings that are missing duration_seconds values

echo "🔧 Fixing missing duration data in voice recordings..."

# Connect to the remote database and update missing duration values
ssh verbumcare-lab.local "docker exec nagare-postgres psql -U nagare -d nagare_db -c \"
UPDATE voice_recordings 
SET duration_seconds = 8 
WHERE duration_seconds IS NULL 
  AND recorded_by = '550e8400-e29b-41d4-a716-446655440105'
  AND recorded_at > '2025-12-10 09:00:00';
\""

echo "✅ Duration data updated"

# Show the updated records
echo "📊 Updated voice recordings:"
ssh verbumcare-lab.local "docker exec nagare-postgres psql -U nagare -d nagare_db -c \"
SELECT recording_id, duration_seconds, recorded_at 
FROM voice_recordings 
WHERE recorded_by = '550e8400-e29b-41d4-a716-446655440105' 
ORDER BY recorded_at DESC 
LIMIT 3;
\""

echo "🔄 Please restart your iPad app to see the updated durations"