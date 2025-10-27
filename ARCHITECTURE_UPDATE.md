# Architecture Update - October 23, 2025

## Summary

VerbumCare demo hardware architecture has been simplified from a two-machine setup to a **single all-in-one server**.

## Previous Architecture (Deprecated)
- **Intel Mac 16GB**: Backend, PostgreSQL, Admin Portal, Dashboard
- **M2 Mac 8GB**: PowerPoint presentation, Ollama (Llama 3), Whisper
- **iPad**: Client app

## Current Architecture
- **pn51-e1**: All services on one machine
  - Docker (PostgreSQL + Backend API)
  - Llama 3.1 8B (upgraded from Llama 3)
  - faster-whisper (optimized implementation)
  - Admin Portal (optional)
  - Dashboard (optional)
- **iPad**: Client app

## Benefits of New Architecture
1. **Simplicity**: Single machine to manage
2. **No Network Latency**: All processing local to one machine
3. **Easier Troubleshooting**: All logs in one place
4. **Reduced Complexity**: No cross-machine communication
5. **Updated AI Models**: Llama 3.1 8B and faster-whisper

## Updated Documentation

### ✅ Files Updated
1. `.claude/session_memory.md` - Hardware Architecture section
2. `.claude/CURRENT_WORK.md` - Added architecture update note
3. `PRE_DEMO_CHECKLIST.md` - Complete rewrite for single-machine setup
4. `OFFLINE_AI_SETUP.md` - Added deprecation notice and updated config

### 📋 Key Changes
- All references to "Intel Mac" and "M2 Mac" replaced with "pn51-e1"
- Network configuration simplified (single server)
- Environment variables updated to use `localhost` for AI services
- Processing time updated: 20-30 seconds (slightly improved)

### 🗑️ Deprecated Files (Not Deleted, Just Not Used)
- `m2-mac-start.sh` - Legacy startup script for M2 Mac
- `intel-mac-start.sh` - Legacy startup script for Intel Mac

These files remain in the repository for historical reference but are no longer used.

## Configuration for pn51-e1

### Environment Variables (backend/.env)
```env
# Database (Docker on localhost)
DATABASE_URL=postgres://demo:demo123@localhost:5432/verbumcare_demo
PORT=3000
NODE_ENV=development

# AI Services (localhost)
WHISPER_URL=http://localhost:8080
WHISPER_MODEL=large-v3
WHISPER_LANGUAGE=ja

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_NUM_CTX=2048
OLLAMA_NUM_THREAD=8
OLLAMA_TEMPERATURE=0.1
```

### Network Configuration
- **Hostname**: `verbumcare-lab.local`
- **iPad API URL**: `https://verbumcare-lab.local/api`
- **Portable WiFi**: LAN-only, offline operation
- **HTTPS**: Uses nginx reverse proxy with self-signed certificate

### Service Verification
```bash
# Backend API (via nginx reverse proxy)
curl -k https://localhost/api/health

# Backend API (direct)
curl http://localhost:3000/health

# PostgreSQL
docker ps | grep postgres

# Llama 3.1 8B
curl http://localhost:11434/api/tags

# faster-whisper
curl http://localhost:8080/health
```

## Demo Workflow

1. Start Docker services: `docker-compose up -d`
2. Verify all services are running
3. Connect iPad to same WiFi as pn51-e1
4. Configure iPad app with API URL
5. Run end-to-end voice processing test
6. Ready for demo!

See `PRE_DEMO_CHECKLIST.md` for complete pre-demo checklist.

## Questions?

Refer to:
- `.claude/session_memory.md` - Complete project context
- `PRE_DEMO_CHECKLIST.md` - Demo day preparation
- `OFFLINE_AI_SETUP.md` - AI service configuration (with legacy notes)

---

**Last Updated**: 2025-10-23
