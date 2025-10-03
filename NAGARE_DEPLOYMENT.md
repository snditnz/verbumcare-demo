# 🏥 Verbumcare Nagare (流れ) - Edge Server Deployment

**Product**: Verbumcare Nagare - Japan Edge Server
**Architecture**: Offline-first, Cloud-sync capable
**Server**: Ubuntu 24.04 LTS (verbumcare-lab.local)

---

## 🌏 Architecture Overview

```
VERBUMCARE NAGARE (流れ) - Japan Edge Server
├── Offline-first operation
├── Local AI processing (Ollama + Whisper)
├── SSL-secured LAN communication
└── Future cloud sync to nagare.verbumcare.com

Ubuntu Server (nagare.local)
├── Bare Metal Services
│   ├── Ollama :11434
│   ├── faster-whisper :8080
│   └── Avahi mDNS (.nagare.local)
│
└── Docker Services
    ├── PostgreSQL :5432
    ├── Backend API :3000
    └── nginx :80, :443
        ├── https://api.nagare.local
        └── https://admin.nagare.local
```

---

## 🚀 Quick Start (30 minutes)

### Prerequisites
- Ubuntu 24.04 LTS x64
- Docker & Docker Compose
- Ollama (running)
- faster-whisper (running)

### Deployment Steps

```bash
# 1. Copy files to server
scp -r verbumcare-demo user@verbumcare-lab.local:/opt/nagare

# 2. SSH to server
ssh user@verbumcare-lab.local
cd /opt/nagare

# 3. Configure mDNS
sudo ./mdns/setup-mdns.sh

# 4. Generate SSL certificates
./ssl/setup-local-ca.sh

# 5. Start Nagare Edge Server
./nagare-start.sh
```

---

## 📋 Detailed Setup

### Step 1: Install Docker (if needed)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### Step 2: Configure mDNS

```bash
# Run mDNS setup (requires sudo)
sudo ./mdns/setup-mdns.sh

# This will:
# - Install Avahi
# - Set hostname to 'nagare'
# - Configure .nagare.local domain
# - Create mDNS service files
# - Enable automatic discovery

# Verify
avahi-browse -a
ping nagare.local
```

### Step 3: Generate SSL Certificates

```bash
# Generate local CA and certificates
./ssl/setup-local-ca.sh

# This creates:
# - Local Certificate Authority (CA)
# - Server certificates for *.nagare.local
# - nginx-ready certificate bundle
# - Client installation guide

# Files created:
# ssl/certs/ca.crt        - Install on client devices
# ssl/certs/nginx.crt     - nginx certificate bundle
# ssl/certs/nginx.key     - nginx private key
```

### Step 4: Verify AI Services

```bash
# Check Ollama
curl http://localhost:11434/api/tags
# Should list available models

# Check faster-whisper
curl http://localhost:8080/health
# Should return OK or health status

# If not running:
ollama serve &                    # Start Ollama
python whisper_server.py &        # Start Whisper (adjust to your setup)
```

### Step 5: Deploy Nagare

```bash
# Run deployment script
./nagare-start.sh

# This will:
# 1. Check prerequisites
# 2. Verify AI services
# 3. Configure environment
# 4. Start Docker services
# 5. Run health checks
# 6. Display access information
```

---

## 🔐 SSL Certificate Installation

### iOS/iPad Setup

1. **Transfer CA certificate to device**:
   ```bash
   # Email or AirDrop this file to iPad:
   ssl/certs/ca.crt
   ```

2. **Install certificate**:
   - Open `ca.crt` file on iPad
   - Settings → Profile Downloaded → Install
   - Enter passcode
   - Tap "Install" (3 times)

3. **Trust certificate**:
   - Settings → General → About → Certificate Trust Settings
   - Enable "Nagare Edge CA"

4. **Verify**:
   - Open Safari
   - Visit: `https://api.nagare.local/health`
   - Should show secure connection ✓

### macOS Setup

```bash
# Install CA certificate
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain ssl/certs/ca.crt

# Verify
security find-certificate -a -c "Nagare Edge CA"
```

### Ubuntu/Linux Setup

```bash
# Install CA certificate
sudo cp ssl/certs/ca.crt /usr/local/share/ca-certificates/nagare-ca.crt
sudo update-ca-certificates

# Verify
curl https://api.nagare.local/health
```

---

## 🌐 Access & Testing

### From Ubuntu Server

```bash
# Test local resolution
ping nagare.local
ping api.nagare.local

# Test HTTP (redirects to HTTPS)
curl http://api.nagare.local

# Test HTTPS (with certificate validation)
curl https://api.nagare.local/health
```

### From Client Devices (iPad, Mac, etc.)

**After installing CA certificate:**

```
API Endpoint:    https://api.nagare.local
Admin Portal:    https://admin.nagare.local
Health Check:    https://api.nagare.local/health
```

**iOS App Configuration:**
- API URL: `https://api.nagare.local`
- All traffic encrypted with local CA

---

## ⚙️ Configuration

### Environment Variables

Key settings in `backend/.env.nagare`:

```bash
# Database
DATABASE_URL=postgres://nagare:PASSWORD@postgres:5432/nagare_db

# CORS (HTTPS only)
CLIENT_URLS=https://admin.nagare.local,https://api.nagare.local

# AI Services
WHISPER_URL=http://host.docker.internal:8080
OLLAMA_URL=http://host.docker.internal:11434

# Nagare Edge
EDGE_SERVER_NAME=Nagare Demo Edge Server
OFFLINE_MODE=true
CLOUD_SYNC_ENABLED=false  # Future: sync to nagare.verbumcare.com

# Japanese Localization
DEFAULT_LANGUAGE=ja
TIMEZONE=Asia/Tokyo
MEDICAL_TERMINOLOGY_STANDARD=HOT
```

### Customization

```bash
# Edit environment
nano backend/.env

# Update CORS origins if needed
CLIENT_URLS=https://admin.nagare.local,https://custom.nagare.local

# Change database password (recommended!)
POSTGRES_PASSWORD=your_secure_password_here

# Restart to apply changes
docker compose -f docker-compose.nagare.yml restart
```

---

## 🛠 Operations

### Start/Stop Services

```bash
# Start
./nagare-start.sh

# Stop
docker compose -f docker-compose.nagare.yml down

# Restart specific service
docker compose -f docker-compose.nagare.yml restart backend

# View status
docker compose -f docker-compose.nagare.yml ps
```

### View Logs

```bash
# All services
docker compose -f docker-compose.nagare.yml logs -f

# Backend only
docker compose -f docker-compose.nagare.yml logs -f backend

# nginx only
docker compose -f docker-compose.nagare.yml logs -f nginx

# Last 100 lines
docker compose -f docker-compose.nagare.yml logs --tail=100
```

### Health Checks

```bash
# Backend health
curl https://api.nagare.local/health

# Database health
docker compose -f docker-compose.nagare.yml exec postgres \
  pg_isready -U nagare -d nagare_db

# nginx status
curl -I http://localhost

# AI services
curl http://localhost:11434/api/tags     # Ollama
curl http://localhost:8080/health         # Whisper
```

---

## 🔍 Troubleshooting

### mDNS Issues

**Problem**: Can't resolve `*.nagare.local` domains

**Solution**:
```bash
# Restart Avahi
sudo systemctl restart avahi-daemon

# Check status
sudo systemctl status avahi-daemon

# Test resolution
avahi-resolve -n api.nagare.local
avahi-browse -a

# Re-run setup if needed
sudo ./mdns/setup-mdns.sh
```

### SSL Certificate Issues

**Problem**: Browser shows certificate warning

**Solution**:
```bash
# Verify certificate is installed on client device
# iOS: Settings → General → About → Certificate Trust Settings
# macOS: Keychain Access → System → Search "Nagare Edge CA"

# Re-generate certificates if needed
./ssl/setup-local-ca.sh
```

### Docker Network Issues

**Problem**: Backend can't reach AI services

**Solution**:
```bash
# Verify host.docker.internal is working
docker compose -f docker-compose.nagare.yml exec backend \
  curl http://host.docker.internal:11434/api/tags

# Check Docker network
docker network inspect nagare_nagare-network

# Restart with fresh network
docker compose -f docker-compose.nagare.yml down
docker compose -f docker-compose.nagare.yml up -d
```

### AI Service Issues

**Problem**: Ollama or Whisper not responding

**Solution**:
```bash
# Check if running
curl http://localhost:11434/api/tags     # Ollama
curl http://localhost:8080/health         # Whisper

# Start if not running
ollama serve &
python whisper_server.py &  # Adjust to your setup

# Check logs
journalctl -u ollama -f  # If systemd service
```

---

## 📊 Performance

### Expected Performance

- **Whisper transcription**: 5-12 seconds
- **Ollama extraction**: 8-15 seconds
- **Total processing**: 15-30 seconds per recording
- **API response**: <100ms for standard queries

### Optimization

```bash
# Increase Ollama threads (in .env)
OLLAMA_NUM_THREAD=12  # Match CPU cores

# Reduce context window (saves memory)
OLLAMA_NUM_CTX=1024

# Use quantized model for speed
OLLAMA_MODEL=llama3:8b-q4_K_M
```

---

## 🔄 Updates & Maintenance

### Update System

```bash
# Pull latest code
git pull

# Rebuild containers
docker compose -f docker-compose.nagare.yml down
docker compose -f docker-compose.nagare.yml build
docker compose -f docker-compose.nagare.yml up -d
```

### Backup Database

```bash
# Backup
docker compose -f docker-compose.nagare.yml exec postgres \
  pg_dump -U nagare nagare_db > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20241003.sql | \
  docker compose -f docker-compose.nagare.yml exec -T postgres \
  psql -U nagare -d nagare_db
```

### Renew SSL Certificates

```bash
# Certificates are valid for 825 days
# When expiring, regenerate:
./ssl/setup-local-ca.sh

# Restart nginx
docker compose -f docker-compose.nagare.yml restart nginx

# Re-install ca.crt on client devices (if CA changed)
```

---

## 🔐 Security Checklist

### Before Production

- [ ] Change default database password
- [ ] Update `SESSION_SECRET` in .env
- [ ] Review CORS settings
- [ ] Enable audit logging
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Document incident response procedures

### Firewall Configuration

```bash
# Ubuntu firewall (ufw)
sudo ufw allow 80/tcp    # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw enable

# Check status
sudo ufw status
```

---

## 📞 Quick Reference

### Key Commands

```bash
# Start
./nagare-start.sh

# Stop
docker compose -f docker-compose.nagare.yml down

# Logs
docker compose -f docker-compose.nagare.yml logs -f backend

# Health
curl https://api.nagare.local/health
```

### Access URLs

```
API:      https://api.nagare.local
Admin:    https://admin.nagare.local
Health:   https://api.nagare.local/health
```

### Service Ports

```
nginx:        80, 443
Backend:      3000 (internal)
PostgreSQL:   5432 (internal)
Ollama:       11434 (host)
Whisper:      8080 (host)
```

### File Locations

```
Environment:  backend/.env
SSL Certs:    ssl/certs/
Logs:         nginx/logs/, backend/logs/
Uploads:      backend/uploads/
Database:     Docker volume (postgres_data)
```

---

## 🎯 Production Roadmap

### Phase 1: Current (Demo/Testing) ✅
- [x] Local AI processing
- [x] SSL with local CA
- [x] mDNS for LAN discovery
- [x] Validated medical prompt

### Phase 2: Production Hardening
- [ ] Authentication & authorization
- [ ] Database encryption
- [ ] Automated backups
- [ ] Monitoring & alerting
- [ ] Load testing

### Phase 3: Cloud Sync
- [ ] Sync to nagare.verbumcare.com
- [ ] Conflict resolution
- [ ] Offline queue management
- [ ] Multi-facility support

---

## 📝 Support

**Deployment Issues**: Review troubleshooting section
**SSL Problems**: Check certificate installation guide
**Performance**: Adjust AI service configuration
**Logs**: `docker compose logs -f backend`

---

**Verbumcare Nagare (流れ)** - Flowing Healthcare Documentation
*Offline-first • Secure • Japan-optimized*
