---
inclusion: always
---

# Mac Mini Production Endpoints

## 🎯 Current Production Status

**Mac Mini is now the PRIMARY PRODUCTION SERVER for VerbumCare**

- **Migration Date**: December 21, 2025
- **Status**: ✅ PRODUCTION READY
- **Auto-Start**: ✅ Configured with LaunchAgent
- **Rollback**: ✅ pn51 available as fallback

## 🌐 Production Endpoints (Mac Mini)

### Primary HTTPS API Endpoints
- **Base URL**: `https://verbumcarenomac-mini.local/`
- **Health Check**: `https://verbumcarenomac-mini.local/health`
- **Patient API**: `https://verbumcarenomac-mini.local/api/patients`
- **Authentication**: `https://verbumcarenomac-mini.local/api/auth/login`
- **Medications**: `https://verbumcarenomac-mini.local/api/medications`
- **Vital Signs**: `https://verbumcarenomac-mini.local/api/vitals`
- **Care Plans**: `https://verbumcarenomac-mini.local/api/care-plans`
- **Clinical Notes**: `https://verbumcarenomac-mini.local/api/clinical-notes`
- **Voice Processing**: `https://verbumcarenomac-mini.local/api/voice`
- **WebSocket**: `wss://verbumcarenomac-mini.local`

### Internal Service Endpoints
- **Database**: `verbumcarenomac-mini.local:5432` (PostgreSQL)
- **Ollama LLM**: `verbumcarenomac-mini.local:11434`
- **Whisper STT**: `verbumcarenomac-mini.local:8080`
- **Backend**: Internal only (via nginx proxy)

### Docker Container Names
- **Database**: `macmini-postgres`
- **Backend**: `macmini-backend`
- **Reverse Proxy**: `macmini-nginx`
- **Network**: `macmini-network`

## 🔄 Legacy Endpoints (Rollback Available)

### pn51 Legacy Endpoints
- **Base URL**: `https://verbumcare-lab.local/`
- **Health Check**: `https://verbumcare-lab.local/health`
- **Patient API**: `https://verbumcare-lab.local/api/patients`
- **Database**: `verbumcare-lab.local:5432`
- **Ollama**: `verbumcare-lab.local:11434`
- **Whisper**: `verbumcare-lab.local:8080`

### Legacy Container Names
- **Database**: `nagare-postgres`
- **Backend**: `nagare-backend`
- **Reverse Proxy**: `nagare-nginx`
- **Network**: `nagare-network`

## 🔧 Management Commands

### Mac Mini Service Management
```bash
# Check all containers
ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps"

# View logs
ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml logs -f [service]"

# Restart all services
ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml restart"

# Stop all services
ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml down"

# Start all services
ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml up -d"
```

### Auto-Start Management
```bash
# Check LaunchAgent status
ssh vcadmin@verbumcarenomac-mini.local 'launchctl list | grep verbumcare'

# Check startup log
ssh vcadmin@verbumcarenomac-mini.local 'cat ~/verbumcare-startup.log'

# Reload LaunchAgent (after making changes)
ssh vcadmin@verbumcarenomac-mini.local 'launchctl unload ~/Library/LaunchAgents/com.verbumcare.startup.plist && launchctl load ~/Library/LaunchAgents/com.verbumcare.startup.plist'
```

### Health Verification
```bash
# Test HTTPS endpoints
curl -k "https://verbumcarenomac-mini.local/health"
curl -k "https://verbumcarenomac-mini.local/api/patients"

# Test AI services
ssh vcadmin@verbumcarenomac-mini.local "curl -s http://localhost:11434/api/tags"
ssh vcadmin@verbumcarenomac-mini.local "curl -s http://localhost:8080/health"

# Verify security (port 3000 should be blocked)
curl --connect-timeout 5 "http://verbumcaremac-mini:3000/health" || echo "✅ Port 3000 correctly blocked"
```

## 📱 Client Application Configuration

### iPad App Configuration
**Update `.env` file:**
```env
# Current Production (Mac Mini)
EXPO_PUBLIC_API_URL=https://verbumcaremac-mini/api

# Legacy (for rollback)
# EXPO_PUBLIC_API_URL=https://verbumcare-lab.local/api
```

### Admin Portal Configuration
**Update `.env` file:**
```env
# Current Production (Mac Mini)
VITE_API_URL=https://verbumcaremac-mini/api
VITE_WS_URL=wss://verbumcaremac-mini

# Legacy (for rollback)
# VITE_API_URL=https://verbumcare-lab.local/api
# VITE_WS_URL=wss://verbumcare-lab.local
```

### Backend Configuration
**Update `.env` file:**
```env
# Current Production (Mac Mini)
DATABASE_URL=postgres://nagare:nagare_secure_password_change_me@verbumcaremac-mini:5432/nagare_db
WHISPER_URL=http://verbumcaremac-mini:8080
OLLAMA_URL=http://verbumcaremac-mini:11434

# Legacy (for rollback)
# DATABASE_URL=postgres://nagare:nagare_secure_password_change_me@verbumcare-lab.local:5432/nagare_db
# WHISPER_URL=http://verbumcare-lab.local:8080
# OLLAMA_URL=http://verbumcare-lab.local:11434
```

## 🔒 Security Architecture

### Current Production Flow (Mac Mini)
```
Client Apps (HTTPS) → macmini-nginx:443 (SSL termination) → macmini-backend:3000 (internal) → macmini-postgres:5432
                                                           ↓
                                            AI Services (localhost)
                                            ├── Ollama:11434 (LLM)
                                            └── Whisper:8080 (STT)
```

### Security Features
- ✅ Backend port 3000 not externally accessible
- ✅ All client access routed through nginx reverse proxy
- ✅ SSL/TLS encryption for all external communication
- ✅ Security headers configured (HSTS, X-Frame-Options, etc.)
- ✅ Self-signed certificates properly mounted and working

## 📊 Performance & Resources

### Mac Mini Resource Usage
- **CPU Usage**: Minimal (~0.01% per container)
- **Memory Usage**: 
  - PostgreSQL: ~76MB
  - Backend: ~48MB  
  - nginx: ~16MB
  - **Total**: ~140MB
- **Disk Usage**: 384GB available
- **Database Size**: 9.7MB

### AI Services Performance
- **Ollama**: Apple Silicon Metal GPU acceleration
- **Whisper**: Optimized for Apple Silicon (fp16 compute)
- **Model Loading**: Fast startup times on M-series chips

## 🚀 Auto-Start Features

### Reliability Features
- **LaunchAgent**: Starts containers when user logs in
- **Periodic monitoring**: Runs every 5 minutes to ensure containers stay running
- **Docker restart policies**: Restarts crashed containers automatically
- **Health verification**: Checks HTTPS endpoint after startup
- **Comprehensive logging**: All startup attempts recorded for troubleshooting

### Auto-Start Status
- ✅ LaunchAgent `com.verbumcare.startup` loaded and active
- ✅ Startup script `/Users/vcadmin/verbumcare-startup.sh`
- ✅ Docker restart policies: `unless-stopped`
- ✅ Periodic monitoring every 5 minutes
- ✅ Health verification after startup

## 🔄 Rollback Procedures

### When to Rollback
- Mac Mini hardware failure
- Critical issues with Mac Mini deployment
- Need to revert to known-good state

### Rollback Steps
1. **Update client applications** to point back to pn51:
   - iPad App: `EXPO_PUBLIC_API_URL=https://verbumcare-lab.local/api`
   - Admin Portal: `VITE_API_URL=https://verbumcare-lab.local/api`
2. **Verify pn51 services** are running:
   ```bash
   ssh verbumcare-lab.local "docker-compose ps"
   curl -k "https://verbumcare-lab.local/health"
   ```
3. **Test functionality** with legacy endpoints
4. **Restore database** from backup if needed

### Rollback Verification
```bash
# Verify pn51 services
ssh verbumcare-lab.local "docker ps | grep -E '(nagare-nginx|nagare-backend|nagare-postgres)'"
curl -k "https://verbumcare-lab.local/health"
curl -k "https://verbumcare-lab.local/api/patients"

# Test AI services
ssh verbumcare-lab.local "curl -s http://localhost:11434/api/tags"
ssh verbumcare-lab.local "curl -s http://localhost:8080/health"
```

## 📋 Migration Summary

### What Was Migrated
- ✅ **Docker Containers**: PostgreSQL, Backend API, nginx
- ✅ **Database**: 9.7MB with 24 tables and data integrity verified
- ✅ **AI Services**: Ollama and Whisper with Apple Silicon optimization
- ✅ **SSL Configuration**: Self-signed certificates and security headers
- ✅ **Auto-Start**: LaunchAgent with periodic monitoring

### Migration Success Criteria - ALL MET
- ✅ All Docker containers running and healthy
- ✅ Database fully migrated with data integrity verified
- ✅ HTTPS endpoints working with proper SSL certificates
- ✅ AI services (Ollama + Whisper) accessible and functional
- ✅ Security properly configured (no external port 3000 access)
- ✅ Network routing and container communication working
- ✅ Rollback capability maintained (pn51 still operational)
- ✅ Performance acceptable for production workloads
- ✅ Auto-start configured for production reliability

## 🎯 Current Status

**🎉 MIGRATION SUCCESSFULLY COMPLETED**

The VerbumCare backend infrastructure has been successfully migrated from pn51 to the Mac Mini. All core services are operational, data integrity is verified, security is properly configured, and the system is ready for production use.

**The Mac Mini is now the primary backend server for VerbumCare.**

Client applications can be updated to point to the new endpoints when ready, with pn51 remaining available as a rollback option.