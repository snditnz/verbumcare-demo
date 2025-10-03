# 🚀 VerbumCare Ubuntu Server - Quick Start Guide

**For**: verbumcare-lab.local (Ubuntu 24.04 LTS x64)
**Time**: 15 minutes to deployment

---

## ✅ Prerequisites Checklist

Your server already has:
- [x] Ubuntu 24.04 LTS x64
- [x] **Ollama** - running and tested
- [x] **faster-whisper** - running and tested
- [x] **Custom medical prompt** - validated with YouTube nursing data

Still need:
- [ ] Docker Engine
- [ ] Docker Compose

---

## 📦 Step 1: Install Docker (5 min)

```bash
# SSH into your Ubuntu server
ssh user@verbumcare-lab.local

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (no sudo needed)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

---

## 📂 Step 2: Deploy VerbumCare (5 min)

### Option A: Clone from repository

```bash
cd /opt
sudo git clone <your-repo-url> verbumcare
sudo chown -R $USER:$USER verbumcare
cd verbumcare
```

### Option B: Copy from your dev machine

```bash
# On your Mac
scp -r /Users/q/Dev/verbumcare.com/verbumcare-demo user@verbumcare-lab.local:/opt/verbumcare

# On Ubuntu server
cd /opt/verbumcare
```

---

## ⚙️ Step 3: Configure Environment (2 min)

```bash
# Copy Ubuntu-specific environment
cp backend/.env.ubuntu backend/.env

# Verify AI services are running
curl http://localhost:11434/api/tags    # Ollama - should list models
curl http://localhost:8080/health        # faster-whisper - should return OK

# If not running, start them:
# Ollama (if needed):
ollama serve &

# faster-whisper (if needed):
# python your-whisper-server.py --port 8080
```

---

## 🐳 Step 4: Start VerbumCare (3 min)

```bash
# Make scripts executable
chmod +x ubuntu-server-start.sh test-ubuntu-api.sh

# Run automated startup
./ubuntu-server-start.sh

# This will:
# ✓ Check prerequisites
# ✓ Verify Ollama and Whisper
# ✓ Start PostgreSQL (Docker)
# ✓ Start Backend API (Docker)
# ✓ Run health checks
```

**Expected output:**
```
✅ VerbumCare Ubuntu Server Ready!

Backend API: http://verbumcare-lab.local:3000
Admin Portal: http://verbumcare-lab.local:5173
```

---

## 🧪 Step 5: Verify Deployment (2 min)

```bash
# Run comprehensive tests
./test-ubuntu-api.sh

# Expected results:
# ✓ 10+ tests passing
# ✓ Ollama: Running
# ✓ Whisper: Running
# ✓ Backend: Healthy
# ✓ Database: Connected
```

---

## 🌐 Access from Client Devices

### iOS/iPad App Configuration

**Method 1: QR Code (Easiest)**
1. Open browser on iPad: `http://verbumcare-lab.local:3000/api/config/display`
2. Scan QR code with app
3. Settings configured automatically ✓

**Method 2: Manual**
1. Open app settings
2. API URL: `http://verbumcare-lab.local:3000/api`
3. Save

### Admin Portal Access

```
URL: http://verbumcare-lab.local:5173

(Admin portal runs separately - optional)
cd admin-portal
npm install
npm run dev
```

---

## 🔍 Common Commands

### View logs
```bash
docker-compose -f docker-compose.ubuntu.yml logs -f backend
docker-compose -f docker-compose.ubuntu.yml logs -f postgres
```

### Restart services
```bash
docker-compose -f docker-compose.ubuntu.yml restart backend
```

### Stop everything
```bash
docker-compose -f docker-compose.ubuntu.yml down
pkill ollama        # If you want to stop Ollama
# Stop your whisper server
```

### Check AI services
```bash
# Ollama
curl http://localhost:11434/api/tags

# Whisper
curl http://localhost:8080/health

# Backend API
curl http://localhost:3000/health
```

---

## 🎯 Your AI Stack Configuration

### Ollama
- **Model**: Your configured model (likely llama3:8b or similar)
- **Prompt**: ✅ **Your validated nursing handoff prompt** (already integrated!)
- **Port**: 11434
- **Location**: Native Ubuntu service

### faster-whisper
- **Model**: Your configured model
- **Port**: 8080
- **Location**: Native Ubuntu service (Python)

### Backend API
- **Port**: 3000
- **Location**: Docker container
- **Connects to**: Ollama + Whisper via host.docker.internal

---

## 📊 What's Different from Mac Setup

| Component | Mac Setup | Ubuntu Setup |
|-----------|-----------|--------------|
| **Ollama** | Running on M2 Mac | ✅ Native Ubuntu |
| **Whisper** | whisper.cpp on Mac | ✅ faster-whisper (Python) |
| **Backend** | Docker on Mac | ✅ Docker on Ubuntu |
| **Database** | Docker on Mac | ✅ Docker on Ubuntu |
| **Network** | mDNS .local | ✅ mDNS .local (same!) |

---

## 🔧 Troubleshooting

### "Can't connect to Ollama"

```bash
# Check if running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve &

# Check logs
journalctl -u ollama -f  # If systemd service
```

### "Can't connect to Whisper"

```bash
# Check if running
curl http://localhost:8080/health

# Start your faster-whisper server
# (Command depends on your setup)
python whisper_server.py --port 8080
```

### "Docker can't access host services"

The docker-compose.ubuntu.yml already includes `host.docker.internal` configuration.

Verify:
```bash
docker-compose -f docker-compose.ubuntu.yml config | grep extra_hosts
# Should show: host.docker.internal: host-gateway
```

### "Permission denied on Docker"

```bash
sudo usermod -aG docker $USER
newgrp docker
# Then retry
```

---

## 🎉 You're Done!

Your VerbumCare system is now running on Ubuntu server with:
- ✅ Your validated medical prompt integrated
- ✅ faster-whisper for transcription
- ✅ Ollama for structured extraction
- ✅ PostgreSQL for data storage
- ✅ Backend API ready for client connections

**Next steps:**
1. Connect your iPad app to `http://verbumcare-lab.local:3000/api`
2. Test with your YouTube validation audio samples
3. Monitor performance and adjust as needed

---

## 📞 Quick Reference

**Service URLs (from Ubuntu server)**
- Ollama: http://localhost:11434
- Whisper: http://localhost:8080
- Backend: http://localhost:3000
- Postgres: localhost:5432

**Service URLs (from client devices)**
- Backend API: http://verbumcare-lab.local:3000/api
- Admin Portal: http://verbumcare-lab.local:5173

**Key Files**
- Environment: `/opt/verbumcare/backend/.env`
- Startup: `/opt/verbumcare/ubuntu-server-start.sh`
- Testing: `/opt/verbumcare/test-ubuntu-api.sh`
- Logs: `docker-compose -f docker-compose.ubuntu.yml logs -f`

**Helpful Commands**
```bash
# Start everything
./ubuntu-server-start.sh

# Test everything
./test-ubuntu-api.sh

# View backend logs
docker-compose -f docker-compose.ubuntu.yml logs -f backend

# Restart backend
docker-compose -f docker-compose.ubuntu.yml restart backend
```
