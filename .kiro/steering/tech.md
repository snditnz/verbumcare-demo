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
# Connect to database
docker exec -it verbumcare-postgres psql -U demo -d verbumcare_demo

# Backup database
docker exec verbumcare-postgres pg_dump -U demo verbumcare_demo > backup.sql

# Restore database
docker exec -i verbumcare-postgres psql -U demo -d verbumcare_demo < backup.sql

# Check database size
docker exec verbumcare-postgres psql -U demo -d verbumcare_demo -c "SELECT pg_size_pretty(pg_database_size('verbumcare_demo'));"
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

### Health Checks
```bash
# Backend API health
curl http://localhost:3000/health

# Backend config display
curl http://localhost:3000/api/config/display

# HTTPS health (with self-signed cert)
curl -k https://verbumcare-lab.local/api/health
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

### Backend (.env)
```env
DATABASE_URL=postgres://demo:demo123@localhost:5432/verbumcare_demo
PORT=3000
NODE_ENV=development

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

### iPad App (.env)
```env
EXPO_PUBLIC_API_URL=https://verbumcare-lab.local/api
```

### Admin Portal (.env)
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```
