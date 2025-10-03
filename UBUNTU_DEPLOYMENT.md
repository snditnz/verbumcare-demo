# 🐧 VerbumCare Ubuntu Server Deployment Guide

**Server**: verbumcare-lab.local (Ubuntu 24.04 LTS x64)
**AI Stack**: Ollama + Whisper (validated and tested)

---

## 🎯 Overview

This guide covers deploying VerbumCare on your Ubuntu 24.04 server with the validated AI stack you've already configured.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Ubuntu Server: verbumcare-lab.local (x64)          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🐳 Docker Containers:                              │
│    ├── PostgreSQL (port 5432)                       │
│    ├── Backend API (port 3000)                      │
│    └── Admin Portal (port 5173) - optional          │
│                                                     │
│  🤖 Host Services:                                  │
│    ├── Ollama (port 11434) - validated ✓           │
│    └── Whisper (port 8080) - validated ✓           │
│                                                     │
└─────────────────────────────────────────────────────┘
         ▲                           ▲
         │                           │
    ┌────┴────┐                ┌────┴────┐
    │  iPad   │                │  Admin  │
    │ Client  │                │  Device │
    └─────────┘                └─────────┘
```

---

## 📋 Prerequisites

### ✅ Already Installed on Your Server
- [x] Ubuntu 24.04 LTS x64
- [x] Ollama (tested)
- [x] Whisper (tested)
- [x] Custom medical prompt (validated with YouTube nursing data)

### 🔧 Still Needed
- [ ] Docker Engine
- [ ] Docker Compose
- [ ] Git (for deployment)

---

## 🚀 Quick Start (30 minutes)

### Step 1: Install Docker (if not already installed)

```bash
# Update packages
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 2: Clone and Setup VerbumCare

```bash
# Clone repository (or copy from your dev machine)
git clone <your-repo-url> /opt/verbumcare
cd /opt/verbumcare

# Or copy from local:
# scp -r /Users/q/Dev/verbumcare.com/verbumcare-demo user@verbumcare-lab.local:/opt/verbumcare
```

### Step 3: Configure Environment

```bash
# Copy Ubuntu environment file
cp backend/.env.ubuntu backend/.env

# Verify AI services are running
curl http://localhost:11434/api/tags    # Ollama
curl http://localhost:8080/health        # Whisper (or whatever endpoint you use)

# If needed, start services
ollama serve &                           # If not running
# Start your Whisper server here         # Based on your setup
```

### Step 4: Start VerbumCare

```bash
# Run the automated startup script
./ubuntu-server-start.sh

# This will:
# 1. Check prerequisites
# 2. Start/verify Ollama and Whisper
# 3. Configure Docker environment
# 4. Start PostgreSQL and Backend
# 5. Run health checks
```

### Step 5: Verify Deployment

```bash
# Run comprehensive tests
./test-ubuntu-api.sh

# Should show all tests passing ✓
```

---

## 🔧 Manual Configuration

### Environment Variables (backend/.env)

Key settings for Ubuntu deployment:

```bash
# Database (Docker internal network)
DATABASE_URL=postgres://demo:demo123@postgres:5432/verbumcare_demo

# AI Services (running on host)
WHISPER_URL=http://host.docker.internal:8080
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3:8b  # Or your specific model

# Server settings
PORT=3000
NODE_ENV=production
```

### Docker Compose

Using Ubuntu-specific configuration:

```bash
# Start services
docker-compose -f docker-compose.ubuntu.yml up -d

# View logs
docker-compose -f docker-compose.ubuntu.yml logs -f backend

# Stop services
docker-compose -f docker-compose.ubuntu.yml down
```

---

## 🤖 AI Services Configuration

### Your Validated Setup

You've already configured and tested:
- ✅ Ollama with medical prompt
- ✅ Whisper for audio transcription
- ✅ End-to-end pipeline with YouTube nursing data

### Integration Points

The backend connects to your AI services via:

1. **Ollama** (`http://localhost:11434`)
   - Model: Your configured model
   - Prompt: Your validated medical extraction prompt
   - Will be synced to `backend/src/services/ollamaService.js`

2. **Whisper** (`http://localhost:8080`)
   - Model: Your configured model
   - Language: Japanese (ja)
   - Audio format: As per your setup

### Custom Medical Prompt Integration

**Please share your validated prompt so I can integrate it!**

The prompt goes in `backend/src/services/ollamaService.js` in the `getSystemPrompt()` method.

Current placeholder:
```javascript
getSystemPrompt(language) {
  const prompts = {
    'ja': `[YOUR VALIDATED PROMPT HERE]`,
    // ...
  };
  return prompts[language] || prompts['en'];
}
```

---

## 🌐 Network Access

### Access URLs

From any device on the same network:

```
Backend API:    http://verbumcare-lab.local:3000/api
Admin Portal:   http://verbumcare-lab.local:5173
Health Check:   http://verbumcare-lab.local:3000/health
```

### Client Configuration

**iOS/iPad App:**
1. Open app settings
2. Set API URL: `http://verbumcare-lab.local:3000/api`
3. Or scan QR code: `http://verbumcare-lab.local:3000/api/config/display`

**Admin Portal:**
1. Access via browser: `http://verbumcare-lab.local:5173`
2. Configure API URL in settings if needed

---

## 🧪 Testing

### Comprehensive Test Suite

```bash
# Run all tests
./test-ubuntu-api.sh

# Tests include:
# - Core API endpoints
# - AI services connectivity
# - Database integrity
# - Performance benchmarks
```

### Manual Testing

```bash
# Test health
curl http://localhost:3000/health

# Test AI services
curl http://localhost:11434/api/tags          # Ollama
curl http://localhost:8080/health             # Whisper

# Test patient API
curl http://localhost:3000/api/patients

# Test AI extraction (requires audio file)
curl -X POST http://localhost:3000/api/voice/upload \
  -F "file=@test-audio.wav" \
  -F "patient_id=550e8400-e29b-41d4-a716-446655440201" \
  -F "language=ja"
```

---

## 📊 Performance

### Expected Performance on Ubuntu Server

- **Whisper Transcription**: 5-10s (depending on audio length)
- **Ollama Extraction**: 8-15s (depending on model and prompt)
- **Total Processing**: 15-30s per recording
- **API Response**: <100ms for standard queries

### Optimization Tips

1. **Ollama Performance**:
   ```bash
   # Set thread count (in .env)
   OLLAMA_NUM_THREAD=8  # Adjust based on CPU cores

   # Reduce context if memory limited
   OLLAMA_NUM_CTX=2048
   ```

2. **Whisper Performance**:
   - Use smaller model for faster processing
   - Or use larger model for better accuracy
   - Configure based on your testing

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Docker can't access host services

**Problem**: Backend can't connect to Ollama/Whisper

**Solution**:
```bash
# Verify host.docker.internal is configured
docker-compose -f docker-compose.ubuntu.yml config | grep extra_hosts

# Should show:
# extra_hosts:
#   host.docker.internal: host-gateway

# If missing, use docker-compose.ubuntu.yml (already configured)
```

#### 2. Ollama not responding

**Problem**: Connection refused on port 11434

**Solution**:
```bash
# Check if running
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve &

# Or as systemd service
sudo systemctl start ollama
sudo systemctl enable ollama
```

#### 3. Whisper not responding

**Problem**: Connection refused on port 8080

**Solution**:
```bash
# Check if running
curl http://localhost:8080/health

# Start based on your installation
# Example for whisper.cpp:
# whisper-server --port 8080 --model /path/to/model

# Example for faster-whisper:
# python whisper-server.py --port 8080
```

#### 4. Permission issues

**Problem**: Docker permission denied

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Or run with sudo (not recommended)
sudo docker-compose -f docker-compose.ubuntu.yml up -d
```

### Logs and Debugging

```bash
# View all logs
docker-compose -f docker-compose.ubuntu.yml logs -f

# View specific service
docker-compose -f docker-compose.ubuntu.yml logs -f backend
docker-compose -f docker-compose.ubuntu.yml logs -f postgres

# Check AI service status
systemctl status ollama  # If running as service
ps aux | grep whisper    # If running as process

# Check Docker network
docker network inspect verbumcare_verbumcare-network
```

---

## 🔐 Security (Production)

### Current Status: **DEMO MODE** ⚠️

The current setup is for demonstration only. For production:

### Required Security Measures

1. **Change Default Passwords**:
   ```bash
   # Update in docker-compose.ubuntu.yml
   POSTGRES_PASSWORD: <strong-password>
   ```

2. **Enable HTTPS/TLS**:
   - Set up reverse proxy (nginx/caddy)
   - Install SSL certificates
   - Force HTTPS redirects

3. **Add Authentication**:
   - Implement JWT authentication
   - Add role-based access control
   - Secure API endpoints

4. **Firewall Configuration**:
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22        # SSH
   sudo ufw allow 443       # HTTPS
   sudo ufw deny 3000       # Block direct API access
   sudo ufw enable
   ```

5. **Database Security**:
   - Enable encryption at rest
   - Use connection pooling with SSL
   - Regular backups

---

## 📈 Monitoring

### Health Checks

```bash
# Automated monitoring
watch -n 5 'curl -s http://localhost:3000/health'

# Check all services
./test-ubuntu-api.sh
```

### System Resources

```bash
# Monitor Docker containers
docker stats

# Monitor system resources
htop

# Monitor AI services
nvidia-smi  # If using GPU
```

---

## 🔄 Updates and Maintenance

### Updating the System

```bash
# Pull latest code
cd /opt/verbumcare
git pull

# Rebuild containers
docker-compose -f docker-compose.ubuntu.yml down
docker-compose -f docker-compose.ubuntu.yml build
docker-compose -f docker-compose.ubuntu.yml up -d

# Run tests
./test-ubuntu-api.sh
```

### Backup Strategy

```bash
# Backup database
docker-compose -f docker-compose.ubuntu.yml exec postgres \
  pg_dump -U demo verbumcare_demo > backup_$(date +%Y%m%d).sql

# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/
```

---

## 📞 Quick Reference

### Service Ports
- PostgreSQL: `5432`
- Backend API: `3000`
- Admin Portal: `5173`
- Ollama: `11434`
- Whisper: `8080`

### Key Commands

```bash
# Start everything
./ubuntu-server-start.sh

# Test everything
./test-ubuntu-api.sh

# View logs
docker-compose -f docker-compose.ubuntu.yml logs -f backend

# Restart services
docker-compose -f docker-compose.ubuntu.yml restart backend

# Stop everything
docker-compose -f docker-compose.ubuntu.yml down
```

### File Locations
- Code: `/opt/verbumcare`
- Logs: `/opt/verbumcare/backend/logs`
- Uploads: `/opt/verbumcare/backend/uploads`
- Database: Docker volume `postgres_data`

---

## ✅ Deployment Checklist

Before going live:

- [ ] Docker and Docker Compose installed
- [ ] Ollama running and validated
- [ ] Whisper running and validated
- [ ] Medical prompt integrated
- [ ] Environment configured (`.env`)
- [ ] Services started (`ubuntu-server-start.sh`)
- [ ] Tests passing (`test-ubuntu-api.sh`)
- [ ] Network access verified from client devices
- [ ] Performance benchmarked
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Documentation reviewed

---

## 🎯 Next Steps

1. **Share your medical prompt** - I'll integrate it into the codebase
2. **Document your Whisper setup** - So we can configure the integration
3. **Test with real data** - Use your YouTube validation samples
4. **Performance tuning** - Optimize based on Ubuntu server specs
5. **Production hardening** - Implement security measures

---

**Need help?**
- Check logs: `docker-compose -f docker-compose.ubuntu.yml logs -f`
- Run diagnostics: `./test-ubuntu-api.sh`
- Review troubleshooting section above
