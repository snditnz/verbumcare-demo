# 🔐 Add SSL + mDNS to Existing Nagare Setup

**For**: Existing `/opt/verbumcare` installation
**Updates**: SSL certificates + mDNS configuration only

---

## 📦 What You Already Have

```
/opt/verbumcare/
├── backend/               ✅ Running
├── docker-compose.yml     ✅ Working
├── Ollama (bare metal)    ✅ Running :11434
└── Whisper (bare metal)   ✅ Running :8080
```

## 🎯 What We're Adding

```
/opt/verbumcare/
├── ssl/                   🆕 SSL certificates
│   ├── setup-local-ca.sh
│   └── certs/
├── mdns/                  🆕 mDNS config
│   └── setup-mdns.sh
├── nginx/                 🆕 nginx configs
│   ├── api.nagare.local.conf
│   └── admin.nagare.local.conf
└── docker-compose.nagare.yml  🆕 With nginx + SSL
```

---

## 🚀 Quick Setup (15 minutes)

### Step 1: Copy New Files to Server

```bash
# From your Mac, copy only the new components
cd /Users/q/Dev/verbumcare.com/verbumcare-demo

# Copy SSL setup
scp -r ssl q@verbumcare-lab.local:/opt/verbumcare/

# Copy mDNS setup
scp -r mdns q@verbumcare-lab.local:/opt/verbumcare/

# Copy nginx configs
scp -r nginx q@verbumcare-lab.local:/opt/verbumcare/

# Copy new docker-compose with nginx
scp docker-compose.nagare.yml q@verbumcare-lab.local:/opt/verbumcare/

# Copy updated .env
scp backend/.env.nagare q@verbumcare-lab.local:/opt/verbumcare/backend/.env.nagare
```

### Step 2: Configure mDNS on Server

```bash
# SSH to server
ssh q@verbumcare-lab.local

cd /opt/verbumcare

# Run mDNS setup (requires sudo)
sudo ./mdns/setup-mdns.sh

# Server will be accessible as:
# - nagare.local
# - api.nagare.local
# - admin.nagare.local
```

### Step 3: Generate SSL Certificates

```bash
# Still on server
cd /opt/verbumcare

# Generate local CA and certificates
./ssl/setup-local-ca.sh

# This creates:
# ssl/certs/ca.crt        - Install on clients
# ssl/certs/nginx.crt     - For nginx
# ssl/certs/nginx.key     - For nginx
```

### Step 4: Update Environment

```bash
# Backup your current .env
cp backend/.env backend/.env.backup

# Merge settings from .env.nagare
# Key changes needed:
nano backend/.env

# Update these lines:
CLIENT_URLS=https://admin.nagare.local,https://api.nagare.local
WHISPER_URL=http://host.docker.internal:8080
OLLAMA_URL=http://host.docker.internal:11434
```

### Step 5: Add nginx to Docker Setup

```bash
# Stop current services
docker compose down

# Start with nginx (using new compose file)
docker compose -f docker-compose.nagare.yml up -d

# Or modify your existing docker-compose.yml to add nginx service
# (see nginx service definition from docker-compose.nagare.yml)
```

---

## 📱 Install CA Certificate on Clients

### iOS/iPad

1. **Transfer certificate**:
   ```bash
   # From server, email/AirDrop to iPad:
   /opt/verbumcare/ssl/certs/ca.crt
   ```

2. **Install**:
   - Open `ca.crt` file
   - Settings → Profile Downloaded → Install
   - Enter passcode
   - Tap "Install" (3 times)

3. **Trust**:
   - Settings → General → About → Certificate Trust Settings
   - Enable "Nagare Edge CA"

4. **Test**:
   - Safari → `https://api.nagare.local/health`
   - Should be secure ✅

### macOS

```bash
# Copy ca.crt from server
scp q@verbumcare-lab.local:/opt/verbumcare/ssl/certs/ca.crt ~/Desktop/

# Install
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain ~/Desktop/ca.crt
```

---

## 🔧 Minimal Changes to Your Existing Setup

### Option A: Add nginx to Existing Compose

Edit your current `/opt/verbumcare/docker-compose.yml`:

```yaml
# Add this service
services:
  # ... your existing postgres and backend ...

  nginx:
    image: nginx:alpine
    container_name: verbumcare-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/api.nagare.local.conf:/etc/nginx/conf.d/api.nagare.local.conf:ro
      - ./ssl/certs/nginx.crt:/etc/nginx/ssl/nginx.crt:ro
      - ./ssl/certs/nginx.key:/etc/nginx/ssl/nginx.key:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - backend
    networks:
      - verbumcare-network
    restart: unless-stopped
```

### Option B: Use New Compose File

```bash
# Just switch to the new file
docker compose -f docker-compose.nagare.yml up -d
```

---

## ✅ Verification

### 1. Test mDNS

```bash
# From server
ping nagare.local
ping api.nagare.local

# From other devices on LAN
ping nagare.local  # Should resolve
```

### 2. Test SSL

```bash
# From server (will fail cert validation without CA installed)
curl -k https://localhost/health

# From client with CA installed
curl https://api.nagare.local/health  # Should work
```

### 3. Test Backend

```bash
# HTTP redirects to HTTPS
curl http://api.nagare.local  # → 301 redirect

# HTTPS works
curl https://api.nagare.local/health  # → 200 OK
```

---

## 🔄 Switching Back (If Needed)

```bash
# Stop nginx version
docker compose -f docker-compose.nagare.yml down

# Start original
docker compose up -d

# Your original setup is preserved
```

---

## 📋 Summary of Changes

### Files Added
- `ssl/` - SSL certificate infrastructure
- `mdns/` - mDNS configuration
- `nginx/` - nginx reverse proxy configs
- `docker-compose.nagare.yml` - With nginx service

### Files Modified
- `backend/.env` - Updated URLs for HTTPS + mDNS

### System Changes
- mDNS: Server accessible as `*.nagare.local`
- SSL: Local CA for secure communication
- nginx: Reverse proxy with HTTPS termination

### Your Existing Setup
- ✅ Ollama - unchanged (still :11434)
- ✅ Whisper - unchanged (still :8080)
- ✅ Backend - unchanged (still :3000 internally)
- ✅ Database - unchanged
- ✅ Your medical prompt - already integrated

---

## 🎯 Result

**Before**: `http://verbumcare-lab.local:3000`
**After**: `https://api.nagare.local`

- ✅ Secure HTTPS with proper certificates
- ✅ Clean mDNS domains (.nagare.local)
- ✅ All existing functionality preserved
- ✅ Ready for iPad clients
