# VerbumCare Technology Stack

## Backend (Node.js/Express)

### Core Technologies
- **Runtime**: Node.js 18+ with ES modules (`"type": "module"`)
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 15 with pg driver
- **Real-time**: Socket.IO for WebSocket communication
- **Security**: helmet, cors, bcryptjs, jsonwebtoken

### Key Dependencies
- `axios` - HTTP client for AI service communication
- `multer` - File upload handling (voice recordings, photos)
- `dotenv` - Environment configuration
- `morgan` - HTTP request logging
- `dayjs` - Date/time manipulation
- `uuid` - UUID generation

### Development
- `nodemon` - Auto-reload during development

## Frontend - iPad App (React Native/Expo)

### Core Technologies
- **Framework**: React Native 0.76.5 with Expo ~52.0.0
- **Language**: TypeScript 5.6.2
- **Navigation**: React Navigation 6.x (native-stack)
- **State Management**: Zustand 5.x
- **HTTP Client**: Axios 1.7.9

### Key Dependencies
- `expo-av` - Audio recording for voice documentation
- `expo-camera` - Camera access for barcode scanning and photos
- `react-native-ble-plx` - Bluetooth Low Energy for medical devices
- `@react-native-async-storage/async-storage` - Local data persistence
- `@react-native-community/netinfo` - Network connectivity detection
- `socket.io-client` - Real-time updates
- `react-native-chart-kit` + `react-native-svg` - Data visualization
- `date-fns` - Date formatting and manipulation

## Frontend - Admin Portal (React/Vite)

### Core Technologies
- **Framework**: React 18.2 with Vite 4.5
- **Language**: JavaScript (JSX)
- **UI Library**: Material-UI (MUI) 5.14
- **State Management**: TanStack React Query 4.x
- **Routing**: React Router DOM 6.x

### Key Dependencies
- `@mui/x-data-grid` - Data tables
- `recharts` - Charts and visualizations
- `react-hook-form` + `yup` - Form handling and validation
- `i18next` + `react-i18next` - Internationalization
- `notistack` - Toast notifications
- `axios` - API client
- `xlsx` - Excel export
- `jspdf` - PDF generation

## AI Services (Offline)

### Speech-to-Text
- **Engine**: faster-whisper (optimized Whisper implementation)
- **Model**: large-v3
- **Language**: Japanese (ja) primary, with English/Chinese support
- **Endpoint**: `http://localhost:8080`

### LLM for Data Extraction
- **Engine**: Ollama
- **Model**: Llama 3.1 8B
- **Context Window**: 2048 tokens (reduced for medical extraction)
- **Temperature**: 0.1 (deterministic output)
- **Threads**: 8
- **Endpoint**: `http://localhost:11434`

## Database (PostgreSQL 15)

### Schema Organization
- **Core Tables**: patients, facilities, staff, medication_orders, medication_administrations, vital_signs
- **Assessments**: barthel_assessments, nursing_assessments
- **Documentation**: clinical_notes, incident_reports, session_data
- **Care Management**: care_plans, care_plan_items, care_plan_monitoring
- **Auth**: users, user_roles

### Migration System
- SQL migration files in `backend/src/db/migrations/`
- Numbered sequentially (001_, 002_, etc.)
- Run via `node src/db/run-migration.js`

## Infrastructure

### Docker Services
- **PostgreSQL**: postgres:15-alpine on port 5432
- **Backend API**: Custom Node.js image on port 3000
- **Volumes**: postgres_data for persistence, uploads for file storage
- **Network**: verbumcare-network bridge

### Deployment Environments
- **Development**: docker-compose.yml (standard setup)
- **Nagare**: docker-compose.nagare.yml (specific hardware config)
- **Ubuntu**: docker-compose.ubuntu.yml (server deployment)

### Network Configuration
- **Hostname**: verbumcare-lab.local (mDNS)
- **SSL**: Self-signed certificates via nginx reverse proxy
- **CORS**: Permissive for LAN deployment (`origin: '*'`)

## CRITICAL ARCHITECTURE REQUIREMENTS

### 🔒 MANDATORY SSL/TLS SECURITY
- **ALL API ACCESS MUST USE HTTPS** - No exceptions for production or testing
- **Port 3000 MUST NOT be exposed externally** - Backend only accessible through nginx reverse proxy
- **nginx reverse proxy MANDATORY** - Handles SSL termination and security headers
- **Self-signed certificates MUST be preserved** - Never regenerate without explicit approval
- **Certificate locations**: 
  - Primary: `/opt/verbumcare/ssl/certs/nginx.crt` and `/opt/verbumcare/ssl/certs/nginx.key`
  - Backup: `/home/q/verbumcare-demo/ssl/certs/` (may be corrupted)

### 🐳 MANDATORY DOCKER CONTAINER NAMES
**NEVER change these container names without explicit approval:**
- **Database**: `nagare-postgres` (postgres:15-alpine)
- **Backend**: `nagare-backend` (verbumcare-demo-backend)
- **Reverse Proxy**: `nagare-nginx` (nginx:alpine)
- **Network**: `nagare-network` (bridge)

### 🔄 MANDATORY DATABASE BACKUP PROTOCOL
**BEFORE ANY DATABASE CHANGES:**
1. **ALWAYS create backup first**: `docker exec nagare-postgres pg_dump -U nagare -d nagare_db > backup_$(date +%Y%m%d_%H%M%S).sql`
2. **Verify backup integrity**: Check file size and content
3. **Document changes**: Record what migration/change is being applied
4. **Test rollback procedure**: Ensure backup can be restored if needed

### 🏗️ SECURE ARCHITECTURE FLOW
```
iPad App (HTTPS) → nginx:443 (SSL termination) → nagare-backend:3000 (internal only) → nagare-postgres:5432
```

### ⚠️ ARCHITECTURE VIOLATIONS - NEVER DO THESE:
- ❌ **Direct port 3000 access** - Backend must only be accessible through nginx
- ❌ **HTTP endpoints** - All client communication must use HTTPS
- ❌ **Certificate regeneration** - Use existing certificates unless explicitly approved
- ❌ **Container name changes** - Maintain consistent naming for operational stability
- ❌ **Database changes without backup** - Data loss is unacceptable
- ❌ **Architecture modifications** - Any changes require explicit approval first

### 🔧 CORRECT DEPLOYMENT VERIFICATION
```bash
# ✅ Verify secure architecture
docker ps | grep -E "(nagare-nginx|nagare-backend|nagare-postgres)"

# ✅ Verify SSL endpoints working
curl -k "https://verbumcare-lab.local/health"

# ✅ Verify port 3000 blocked
curl --connect-timeout 5 "http://verbumcare-lab.local:3000/health" || echo "Correctly blocked"

# ✅ Verify database connectivity (internal only)
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT 1;"
```

## Common Commands

### Backend Development
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Stop services
docker-compose down

# Reset database (WARNING: destroys data)
docker-compose down -v
docker-compose up -d

# Run migrations
cd backend
node src/db/run-migration.js

# Seed database
node src/db/seed.js

# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### 🔄 CRITICAL: Updating Backend Code Changes
**The backend runs in a Docker container with code baked into the image. File changes are NOT automatically picked up!**

#### When Backend Code Changes Don't Work:
If you make changes to backend files but they don't take effect, it's because:
- Backend runs from Docker image, not mounted source code
- Only `/uploads` directory is mounted as volume
- Source code is compiled into the Docker image

#### How to Deploy Backend Code Changes:
```bash
# Method 1: Copy single file and restart (FASTEST)
scp backend/src/path/to/changed-file.js verbumcare-lab.local:/home/q/verbumcare-demo/backend/src/path/to/changed-file.js
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker restart nagare-backend"

# Method 2: Rebuild Docker image (COMPLETE)
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker-compose build backend && docker-compose up -d backend"

# Method 3: Copy entire backend directory (COMPREHENSIVE)
scp -r backend/ verbumcare-lab.local:/home/q/verbumcare-demo/
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker restart nagare-backend"
```

#### Verification Steps:
```bash
# 1. Verify file was copied
ssh verbumcare-lab.local "ls -la /home/q/verbumcare-demo/backend/src/path/to/changed-file.js"

# 2. Check if changes are in the file
ssh verbumcare-lab.local "grep -n 'your-change-marker' /home/q/verbumcare-demo/backend/src/path/to/changed-file.js"

# 3. Restart backend to pick up changes
ssh verbumcare-lab.local "docker restart nagare-backend"

# 4. Verify backend is running
ssh verbumcare-lab.local "docker logs nagare-backend --tail 10"

# 5. Test the change
curl -k "https://verbumcare-lab.local/health"
```

#### Common Symptoms of Stale Code:
- ❌ Changes to backend files don't take effect
- ❌ New console.log statements don't appear in logs
- ❌ Bug fixes don't resolve the issue
- ❌ API endpoints return old behavior
- ❌ Error messages remain unchanged

#### Debug Commands:
```bash
# Check if backend container is using old code
ssh verbumcare-lab.local "docker exec nagare-backend cat /app/src/path/to/file.js | head -20"

# Compare local vs remote file
diff backend/src/path/to/file.js <(ssh verbumcare-lab.local "cat /home/q/verbumcare-demo/backend/src/path/to/file.js")

# Check container mount points
ssh verbumcare-lab.local "docker inspect nagare-backend | grep -A 10 Mounts"
```

### iPad App Development
```bash
# Install dependencies
npm install

# Start Expo dev server (LAN mode)
npm start
# or
npm run dev

# Clear cache and restart
npm run start:clear

# Build for iOS device
npm run build:dev

# Clean everything (nuclear option)
npm run clean
```

### Admin Portal Development
```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Management
```bash
# Connect to database (CURRENT PRODUCTION CREDENTIALS)
docker exec -it nagare-postgres psql -U nagare -d nagare_db

# MANDATORY BACKUP BEFORE ANY CHANGES
docker exec nagare-postgres pg_dump -U nagare -d nagare_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database (EMERGENCY ONLY)
docker exec -i nagare-postgres psql -U nagare -d nagare_db < backup_YYYYMMDD_HHMMSS.sql

# Check database size
docker exec nagare-postgres psql -U nagare -d nagare_db -c "SELECT pg_size_pretty(pg_database_size('nagare_db'));"

# Run migrations (BACKUP FIRST!)
ssh verbumcare-lab.local "docker exec nagare-backend node src/db/run-migration.js MIGRATION_FILE.sql"
```

### AI Services
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Check Whisper status
curl http://localhost:8080/health

# Test Ollama generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Hello",
  "stream": false
}'
```

### nginx SSL Reverse Proxy Deployment
```bash
# 🔒 CRITICAL: nginx Deployment with SSL Certificates

# 1. Verify SSL certificates exist (MANDATORY LOCATIONS)
ssh verbumcare-lab.local "ls -la /opt/verbumcare/ssl/certs/nginx.* && ls -la /opt/verbumcare/ssl/private/"

# 2. Deploy nginx with correct SSL certificates
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker run -d --name nagare-nginx --network nagare-network -p 80:80 -p 443:443 \
  -v ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v ./nginx/verbumcare-lab.local.conf:/etc/nginx/conf.d/verbumcare-lab.local.conf:ro \
  -v /opt/verbumcare/ssl/certs/nginx.crt:/etc/nginx/ssl/nginx.crt:ro \
  -v /opt/verbumcare/ssl/certs/nginx.key:/etc/nginx/ssl/nginx.key:ro \
  nginx:alpine"

# 3. Verify nginx configuration points to correct backend
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && grep 'nagare-backend:3000' nginx/verbumcare-lab.local.conf"

# 4. Fix nginx configuration if needed (update backend container name)
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && sed -i 's/nagare-backend-temp:3000/nagare-backend:3000/g' nginx/verbumcare-lab.local.conf"

# 5. Restart nginx if configuration changed
ssh verbumcare-lab.local "docker restart nagare-nginx"

# 6. Verify nginx logs for errors
ssh verbumcare-lab.local "docker logs nagare-nginx | tail -10"
```

### SSL Certificate Locations (CRITICAL REFERENCE)
```bash
# 🔒 PRIMARY CERTIFICATE LOCATIONS (USE THESE)
/opt/verbumcare/ssl/certs/nginx.crt    # SSL Certificate (TRUSTED)
/opt/verbumcare/ssl/certs/nginx.key    # SSL Private Key (TRUSTED)
/opt/verbumcare/ssl/private/ca.key     # Certificate Authority Key
/opt/verbumcare/ssl/certs/ca.crt       # Certificate Authority Certificate

# ⚠️ BACKUP LOCATIONS (MAY BE CORRUPTED)
/home/q/verbumcare-demo/ssl/certs/nginx.crt  # May be directory instead of file
/home/q/verbumcare-demo/ssl/certs/nginx.key  # May be directory instead of file

# 🔍 CERTIFICATE VERIFICATION
ssh verbumcare-lab.local "openssl x509 -in /opt/verbumcare/ssl/certs/nginx.crt -text -noout | grep -E '(Subject|Issuer|Not After)'"
```

### Health Checks
```bash
# ✅ CORRECT: HTTPS health check (MANDATORY)
curl -k "https://verbumcare-lab.local/health"

# ✅ CORRECT: HTTPS API endpoints (MANDATORY)
curl -k "https://verbumcare-lab.local/api/patients"

# ✅ CORRECT: HTTPS login test
curl -k -X POST "https://verbumcare-lab.local/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo123"}' | jq '.success'

# ❌ WRONG: Direct backend access (SECURITY VIOLATION)
# curl http://localhost:3000/health  # This should FAIL

# ✅ Verify architecture security
curl --connect-timeout 5 "http://verbumcare-lab.local:3000/health" || echo "✅ Port 3000 correctly blocked"
```

## Build & Test

### Backend
- No test suite currently configured
- Manual API testing via curl or Postman
- Health check endpoint: `/health`

### iPad App
- No test suite currently configured
- Manual testing on physical iPad devices
- Expo Go not supported (uses custom native modules)

### Admin Portal
- ESLint configured for code quality
- No automated tests currently
- Manual testing in browser

## Environment Variables

### Backend (.env) - PRODUCTION CONFIGURATION
```env
# PRODUCTION DATABASE (CURRENT)
DATABASE_URL=postgres://nagare:nagare_secure_password_change_me@verbumcare-lab.local:5432/nagare_db
PORT=3000
NODE_ENV=production

# AI Services (localhost for single-server setup)
WHISPER_URL=http://localhost:8080
WHISPER_MODEL=large-v3
WHISPER_LANGUAGE=ja

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_THREAD=8
OLLAMA_TEMPERATURE=0.1

# CORS (permissive for LAN)
API_CORS_ORIGIN=*
SOCKET_CORS_ORIGIN=*
```

### iPad App (.env) - SECURE CONFIGURATION
```env
# ✅ MANDATORY: HTTPS endpoint only
EXPO_PUBLIC_API_URL=https://verbumcare-lab.local/api
```

### Admin Portal (.env) - SECURE CONFIGURATION
```env
# ✅ MANDATORY: HTTPS endpoints only
VITE_API_URL=https://verbumcare-lab.local/api
VITE_WS_URL=wss://verbumcare-lab.local
```
