# VerbumCare Healthcare Documentation Demo

A complete healthcare documentation system demonstrating AI-powered voice processing, multi-language support, and secure medication administration tracking.

## 🏥 System Architecture

- **Backend API**: Node.js/Express with PostgreSQL
- **iOS Nurse App**: React Native/Expo (iPad/iPhone interface)
- **Admin Portal**: React web application
- **Dashboard**: Real-time monitoring web interface
- **Multi-language**: Japanese, English, Traditional Chinese

## 📋 Features

### Core Functionality
- **Patient Management**: Demographics, room assignments, medical records
- **Medication Administration**: Barcode scanning, dosage tracking, safety verification
- **Vital Signs**: Manual entry, IoT device integration, automated alerts
- **Voice Documentation**: AI transcription and structured data extraction
- **Real-time Dashboard**: Live metrics, patient status, alerts
- **Export Capabilities**: HL7 v2.5, SS-MIX2, PDF reports

### Security & Compliance
- **Cryptographic Hash Chain**: Immutable medication administration records
- **Audit Trail**: Complete action logging with timestamps
- **Multi-language Support**: Japanese, English, Traditional Chinese
- **Data Validation**: Clinical range checking and alert generation

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- OpenAI API key (optional, falls back to mock data)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd verbumcare-demo
cp backend/.env.example backend/.env
```

### 2. Configure Environment
Edit `backend/.env`:
```env
DATABASE_URL=postgres://demo:demo123@localhost:5432/verbumcare_demo
OPENAI_API_KEY=your_openai_api_key_here  # Optional
PORT=3000
NODE_ENV=development
```

### 3. Start Services
```bash
# Start PostgreSQL and Backend API
docker-compose up -d

# View logs
docker-compose logs -f backend

# Health check
curl http://localhost:3000/health
```

### 4. Verify Installation
- Backend API: http://localhost:3000/health
- Database: `docker exec -it verbumcare-postgres psql -U demo -d verbumcare_demo -c "SELECT COUNT(*) FROM patients;"`

## 📊 Demo Data

The system includes realistic demo data:

### Patients (5 total)
1. **山田太郎 (Yamada Taro)** - Room 305A, Age 68
   - Medications: Aspirin, Metformin, Amlodipine
   - Alert: Elevated blood pressure

2. **田中優希 (Tanaka Yuki)** - Room 307B, Age 45
   - PRN medications available
   - Suitable for voice assessment demo

3. **佐藤健二 (Sato Kenji)** - Room 309C, Age 72
   - Multiple scheduled medications
   - Good for medication round workflow

4. **鈴木愛子 (Suzuki Aiko)** - Room 311A, Age 55
   - Post-operative care
   - Frequent vital signs monitoring

5. **渡辺博 (Watanabe Hiroshi)** - Room 315B, Age 80
   - Dementia patient
   - Demonstrates safety protocols

### Staff Members
- **佐藤美咲** (Sato Misaki) - Registered Nurse
- **鈴木花子** (Suzuki Hanako) - Registered Nurse
- **田中健一** (Tanaka Kenichi) - Physician

## 🔗 API Endpoints

### Patient Management
```
GET    /api/patients                    # List all patients
GET    /api/patients/:id                # Get patient details
GET    /api/patients/barcode/:barcode   # Verify patient barcode
POST   /api/patients                    # Create patient
PUT    /api/patients/:id                # Update patient
```

### Medication Administration
```
GET    /api/medications/patient/:id           # Patient medications
GET    /api/medications/patient/:id/today    # Today's scheduled meds
GET    /api/medications/barcode/:barcode     # Verify medication
POST   /api/medications/administer           # Record administration
```

### Vital Signs
```
GET    /api/vitals/patient/:id               # Patient vital history
POST   /api/vitals                           # Record vital signs
GET    /api/vitals/patient/:id/latest       # Latest vitals with alerts
```

### Voice Processing
```
POST   /api/voice/upload                     # Upload audio file
POST   /api/voice/process                    # Process with AI
GET    /api/voice/recording/:id              # Get recording details
```

### Dashboard & Reports
```
GET    /api/dashboard/metrics                # Key performance indicators
GET    /api/dashboard/patients/status        # Patient status overview
GET    /api/dashboard/activity/recent        # Recent activity feed
GET    /api/dashboard/alerts                 # Active alerts
GET    /api/dashboard/export/hl7             # Generate HL7 messages
GET    /api/dashboard/export/ss-mix2         # Generate SS-MIX2 export
```

## 🎯 Testing Scenarios

### 1. Medication Administration Workflow
```bash
# 1. Get patient list
curl "http://localhost:3000/api/patients"

# 2. Get today's medications for patient
curl "http://localhost:3000/api/medications/patient/550e8400-e29b-41d4-a716-446655440201/today"

# 3. Verify patient barcode
curl "http://localhost:3000/api/patients/barcode/PAT-MRN001-ABC123"

# 4. Verify medication barcode
curl "http://localhost:3000/api/medications/barcode/MED-1140001-XYZ789"

# 5. Record administration
curl -X POST "http://localhost:3000/api/medications/administer" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "order-uuid",
    "patient_id": "patient-uuid",
    "patient_barcode_scanned": true,
    "medication_barcode_scanned": true,
    "administered_by": "staff-uuid"
  }'
```

### 2. Vital Signs Recording
```bash
curl -X POST "http://localhost:3000/api/vitals" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "550e8400-e29b-41d4-a716-446655440201",
    "blood_pressure_systolic": 145,
    "blood_pressure_diastolic": 92,
    "heart_rate": 78,
    "temperature_celsius": 37.2,
    "oxygen_saturation": 98,
    "pain_score": 2,
    "recorded_by": "550e8400-e29b-41d4-a716-446655440101"
  }'
```

### 3. Dashboard Metrics
```bash
# Get today's metrics
curl "http://localhost:3000/api/dashboard/metrics"

# Get patient status overview
curl "http://localhost:3000/api/dashboard/patients/status"

# Get recent activity
curl "http://localhost:3000/api/dashboard/activity/recent?limit=10"

# Get active alerts
curl "http://localhost:3000/api/dashboard/alerts"
```

### 4. HL7 Export
```bash
# Generate HL7 messages for today
curl "http://localhost:3000/api/dashboard/export/hl7?type=all"

# Generate vitals HL7 only
curl "http://localhost:3000/api/dashboard/export/hl7?type=vitals"

# Generate SS-MIX2 export
curl "http://localhost:3000/api/dashboard/export/ss-mix2"
```

## 🌐 Multi-language Support

The API automatically detects language from the `Accept-Language` header:

```bash
# Japanese
curl -H "Accept-Language: ja" "http://localhost:3000/api/patients"

# English
curl -H "Accept-Language: en" "http://localhost:3000/api/patients"

# Traditional Chinese
curl -H "Accept-Language: zh-TW" "http://localhost:3000/api/patients"
```

## 🔐 Cryptographic Hash Chain

Medication administrations use a SHA-256 hash chain for immutability:

```bash
# Verify chain integrity
curl "http://localhost:3000/api/dashboard/chain/verify"
```

Each administration record contains:
- `record_hash`: SHA-256 of current record
- `previous_hash`: Links to previous record
- `chain_sequence`: Sequential number for ordering

## 🛠 Development

### Database Management
```bash
# Connect to database
docker exec -it verbumcare-postgres psql -U demo -d verbumcare_demo

# Reset database
docker-compose down -v
docker-compose up -d

# View logs
docker-compose logs -f postgres
```

### Backend Development
```bash
cd backend
npm install
npm run dev  # Starts with nodemon
```

### API Testing
```bash
# Install dependencies
npm install -g newman

# Run API tests (if available)
newman run tests/api-tests.json
```

## 📱 Mobile App Setup

The React Native nurse app is designed for iPad/iPhone:

```bash
cd nurse-app
npm install
npx expo start

# For iOS simulator
npx expo start --ios

# For physical device
npx expo start --tunnel
```

## 💻 Web Applications

### Admin Portal
```bash
cd admin-portal
npm install
npm run dev  # Runs on http://localhost:5173
```

### Dashboard
```bash
cd dashboard
npm install
npm run dev  # Runs on http://localhost:5174
```

## 🔧 Configuration

### Environment Variables
```env
# Backend (.env)
DATABASE_URL=postgres://user:pass@host:port/db
OPENAI_API_KEY=sk-...  # Optional
PORT=3000
NODE_ENV=development
CLIENT_URLS=http://localhost:5173,http://localhost:5174

# Frontend (.env)
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000

# Mobile App (.env)
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   docker-compose down
   docker-compose up -d postgres
   # Wait for postgres to be ready, then start backend
   ```

2. **Port Already in Use**
   ```bash
   # Kill processes on port 3000
   lsof -ti:3000 | xargs kill -9
   ```

3. **Missing Voice Files**
   ```bash
   mkdir -p backend/uploads/voice
   chmod 755 backend/uploads
   ```

4. **OpenAI API Errors**
   - The system works without OpenAI API (uses mock data)
   - Set `OPENAI_API_KEY=demo` to suppress warnings

### Log Monitoring
```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres

# All services
docker-compose logs -f
```

## 📋 Production Deployment

For production deployment:

1. **Security Hardening**
   - Change default database passwords
   - Set up SSL/TLS certificates
   - Configure proper CORS origins
   - Enable rate limiting

2. **Performance Optimization**
   - Set up connection pooling
   - Configure Redis for session storage
   - Enable gzip compression
   - Set up CDN for static assets

3. **Monitoring**
   - Set up application monitoring (e.g., New Relic)
   - Configure log aggregation (e.g., ELK stack)
   - Set up health check endpoints
   - Configure alerting for critical errors

## 📄 License

This is a demonstration project for VerbumCare healthcare documentation system.

## 🤝 Support

For technical questions or issues:
1. Check the troubleshooting section above
2. Review the API documentation
3. Check Docker container logs
4. Verify environment configuration