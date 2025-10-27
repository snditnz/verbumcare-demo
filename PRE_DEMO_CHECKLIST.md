# 📋 VerbumCare Demo Day Pre-Flight Checklist

**Complete this checklist 30 minutes before demo start time**

---

## ⏰ Timeline: 30 Minutes Before Demo

### T-30min: Network Setup

- [ ] **Turn on portable WiFi router**
- [ ] **Connect pn51-e1 to WiFi**
  - Network name: _________________
  - Signal strength: Strong (3+ bars)
- [ ] **Connect iPad to WiFi**
  - Network name: _________________
  - Signal strength: Strong (3+ bars)

**Verify network:**
```bash
# On pn51-e1:
ip addr show  # or ifconfig
# Note the IP address

# From iPad or another device:
ping verbumcare-lab.local
```

- [ ] **verbumcare-lab.local is reachable from iPad** ✅

---

### T-25min: pn51-e1 (All-in-One Server) Setup

**Close unnecessary apps:**
- [ ] Close browsers (non-demo tabs)
- [ ] Close unnecessary background services
- [ ] Keep only Terminal + monitoring tools

**Verify installations:**
- [ ] Docker is installed and running
  ```bash
  docker --version
  docker ps
  ```
- [ ] Project directory accessible
  ```bash
  cd /path/to/verbumcare-demo
  ls -la docker-compose.yml
  ```

**Verify AI services:**
- [ ] Llama 3.1 8B installed and accessible
  ```bash
  # Check if Ollama is running
  curl http://localhost:11434/api/tags
  # Should show llama3.1:8b or similar
  ```
- [ ] faster-whisper installed and accessible
  ```bash
  # Check whisper service
  curl http://localhost:8080/health
  # OR check the service status
  systemctl status whisper  # if running as systemd service
  ```

**Verify configuration:**
- [ ] `backend/.env` file exists
- [ ] `backend/.env` contains correct URLs:
  ```
  WHISPER_URL=http://localhost:8080
  OLLAMA_URL=http://localhost:11434
  ```

**Start services:**
- [ ] Start Docker services:
  ```bash
  docker-compose up -d
  ```
- [ ] Verify containers are running:
  ```bash
  docker ps
  # Should see: PostgreSQL, Backend API
  ```
- [ ] **Backend API responding** at http://localhost:3000/health
- [ ] **PostgreSQL running** (check `docker ps`)

**Start AI services (if not already running):**
- [ ] Start Llama 3.1 8B (Ollama)
  ```bash
  # Usually auto-starts, but verify:
  curl http://localhost:11434/api/tags
  ```
- [ ] Start faster-whisper service
  ```bash
  # Check your whisper startup command/service
  ```

**System check:**
```bash
# Check memory usage
free -h  # Linux
# OR
htop
```
- [ ] **Memory usage reasonable** ✅
- [ ] **All services responding** ✅

---

### T-15min: Service Verification

**Test all services on pn51-e1:**
```bash
# Backend API
curl http://localhost:3000/health

# PostgreSQL (via backend or direct)
docker exec -it verbumcare-postgres psql -U demo -d verbumcare_demo -c "SELECT COUNT(*) FROM patients;"

# Llama 3.1 8B
curl http://localhost:11434/api/tags

# faster-whisper
curl http://localhost:8080/health
```
- [ ] **Backend API responding** ✅
- [ ] **PostgreSQL accessible** ✅
- [ ] **Llama 3.1 8B ready** ✅
- [ ] **faster-whisper ready** ✅

---

### T-10min: iPad Client Setup

**Option A: QR Code Configuration (Recommended)**
- [ ] On any device, open: `https://verbumcare-lab.local/api/config/display`
- [ ] QR code visible
- [ ] Open iOS app on iPad
- [ ] Scan QR code
- [ ] App configured automatically

**Option B: Manual Configuration**
- [ ] Open iOS app settings
- [ ] Enter API URL: `https://verbumcare-lab.local/api`
- [ ] Save configuration

**Test connection:**
- [ ] iPad app connects to backend
- [ ] Can see patient list
- [ ] No error messages

---

### T-5min: End-to-End Test

**Run a complete voice processing test:**

1. **Record short test audio** on iPad (5-10 seconds):
   - "これはテストです" (This is a test)

2. **Upload and process**

3. **Monitor processing on pn51-e1:**
   - [ ] Upload completes (~1-2 seconds)
   - [ ] Processing starts (watch backend logs)
   - [ ] Results return in 20-30 seconds
   - [ ] No errors displayed

4. **Check system resources during processing:**
   ```bash
   # In another terminal on pn51-e1
   watch -n 2 'free -h && echo "---" && docker stats --no-stream'
   ```
   - [ ] **Memory usage reasonable** (expected spike during AI processing)
   - [ ] **No "out of memory" warnings**
   - [ ] **System stable after processing**

---

### T-2min: Final Checks

**pn51-e1:**
- [ ] Docker containers running (`docker ps` shows containers)
- [ ] Backend API responding
- [ ] Llama 3.1 8B ready
- [ ] faster-whisper ready
- [ ] No error logs visible
- [ ] Network stable

**iPad:**
- [ ] Connected to WiFi
- [ ] App logged in (if required)
- [ ] Battery > 50%
- [ ] Volume appropriate (if audio playback needed)

**Environment:**
- [ ] Projector/screen connected and working
- [ ] Presentation ready (if applicable)
- [ ] All cables secure
- [ ] Room lighting appropriate

---

## 🚨 Emergency Fallbacks

### If network discovery fails:
```bash
# Find pn51-e1 IP:
# On pn51-e1:
ip addr show | grep "inet " | grep -v 127.0.0.1
# OR
hostname -I

# Update iPad app with actual IP:
# In app settings, use: https://192.168.x.x/api
```

### If AI services fail:
- **Backend automatically falls back to mock data**
- Demo continues with synthetic results
- Audience won't notice if you don't mention it

### If Llama 3.1 or faster-whisper stops responding:
1. Check service status
2. Restart services if needed:
   ```bash
   # Restart Ollama (if using systemd)
   systemctl restart ollama

   # Restart faster-whisper
   # Use your specific restart command
   ```
3. Backend will fall back to mock data if services don't respond

### If Docker fails on pn51-e1:
- Restart Docker:
  ```bash
  systemctl restart docker  # or sudo service docker restart
  ```
- Re-run docker-compose:
  ```bash
  docker-compose down
  docker-compose up -d
  ```
- Wait 1-2 minutes for startup

---

## ✅ Ready for Demo!

When all items are checked:
- [ ] **All systems green** ✅
- [ ] **pn51-e1 server healthy** ✅
- [ ] **Network connectivity verified** ✅
- [ ] **End-to-end test successful** ✅
- [ ] **Presenter confident** ✅

**Demo start time:** ________________

**Expected processing time per recording:** 20-30 seconds

**Good luck! 🎯**

---

## 📞 Quick Reference

**pn51-e1 Services:**
- Backend API: https://localhost/api (nginx reverse proxy)
- PostgreSQL: localhost:5432
- Llama 3.1 8B (Ollama): http://localhost:11434
- faster-whisper: http://localhost:8080
- Admin Portal: (if running)
- Dashboard: (if running)

**Network Names:**
- pn51-e1: `verbumcare-lab.local`

**From iPad:**
- API URL: `https://verbumcare-lab.local/api`

**Stop Everything:**
```bash
# On pn51-e1:
docker-compose down
pkill -f "npm run dev"  # if running admin portal/dashboard

# Restart everything:
docker-compose up -d
```