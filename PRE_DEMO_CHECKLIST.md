# 📋 VerbumCare Demo Day Pre-Flight Checklist

**Complete this checklist 30 minutes before demo start time**

---

## ⏰ Timeline: 30 Minutes Before Demo

### T-30min: Network Setup

- [ ] **Turn on portable WiFi router**
- [ ] **Connect Intel Mac to WiFi**
  - Network name: _________________
  - Signal strength: Strong (3+ bars)
- [ ] **Connect M2 Mac to WiFi**
  - Network name: _________________
  - Signal strength: Strong (3+ bars)
- [ ] **Connect iPad to WiFi**
  - Network name: _________________
  - Signal strength: Strong (3+ bars)

**Verify network:**
```bash
# On Intel Mac:
ping -c 3 verbumcare-ai.local

# On M2 Mac:
ping -c 3 verbumcare-server.local
```

- [ ] **Both Macs can reach each other** ✅

---

### T-25min: Intel Mac (Server) Setup

**Close unnecessary apps:**
- [ ] Close Slack, Email, Chrome (non-demo tabs)
- [ ] Close Spotify, Music, etc.
- [ ] Keep only Terminal + necessary monitoring tools

**Verify installations:**
- [ ] Docker Desktop is installed and running
  ```bash
  docker --version
  docker info
  ```
- [ ] Project directory accessible
  ```bash
  cd /path/to/verbumcare-demo
  ls -la docker-compose.yml
  ```

**Verify configuration:**
- [ ] `backend/.env` file exists
- [ ] `backend/.env` contains:
  ```
  WHISPER_URL=http://verbumcare-ai.local:8080
  OLLAMA_URL=http://verbumcare-ai.local:11434
  ```

**Start services:**
- [ ] Run startup script:
  ```bash
  ./intel-mac-start.sh
  ```
- [ ] Wait for "✅ Intel Mac Server Startup Complete!"
- [ ] **Backend API responding** at http://localhost:3000/health
- [ ] **PostgreSQL running** (check Docker Desktop or `docker ps`)
- [ ] **Admin Portal accessible** (optional verification)

**Memory check:**
```bash
# Should show ~5GB used, ~11GB free
top -l 1 | grep PhysMem
```
- [ ] **Memory usage under 50%** ✅

---

### T-20min: M2 Mac (AI + Presentation) Setup

**Close ALL unnecessary apps:**
- [ ] Quit Slack, Email, Messages
- [ ] Quit Safari (non-demo tabs), Chrome
- [ ] Quit Spotify, Music, Calendar
- [ ] Quit ALL background apps
- [ ] **Only keep: Terminal + PowerPoint** (don't open PPT yet)

**Verify installations:**
- [ ] Ollama installed
  ```bash
  ollama --version
  which ollama
  ```
- [ ] Whisper installed
  ```bash
  which whisper-server
  # OR check for faster-whisper
  ```
- [ ] Models downloaded
  ```bash
  ollama list | grep llama3:8b
  ls models/ggml-large-v3.bin  # OR check ~/.cache/whisper/
  ```

**Start AI services:**
- [ ] Run startup script:
  ```bash
  ./m2-mac-start.sh
  ```
- [ ] Wait for "✅ M2 Mac AI Services Ready!"
- [ ] **Ollama responding** at http://localhost:11434/api/tags
- [ ] **Whisper responding** at http://localhost:8080/health

**Memory check:**
```bash
# Should show ~3.5GB used initially
top -l 1 | grep PhysMem
```
- [ ] **Memory usage under 50%** (before PowerPoint) ✅
- [ ] **6-7GB free** ✅

**Open presentation:**
- [ ] Open PowerPoint presentation
- [ ] Set to full screen (presentation mode)
- [ ] Test navigation (arrow keys work)

**Final memory check:**
```bash
top -l 1 | grep PhysMem
```
- [ ] **Memory usage 40-50%** (with PowerPoint) ✅
- [ ] **4-5GB free** ✅

---

### T-15min: Cross-Machine Verification

**From Intel Mac, test M2 AI services:**
```bash
curl http://verbumcare-ai.local:11434/api/tags
curl http://verbumcare-ai.local:8080/health
```
- [ ] **Ollama reachable from Intel Mac** ✅
- [ ] **Whisper reachable from Intel Mac** ✅

**From M2 Mac, test Intel backend:**
```bash
curl http://verbumcare-server.local:3000/health
```
- [ ] **Backend reachable from M2 Mac** ✅

---

### T-10min: iPad Client Setup

**Option A: QR Code Configuration (Recommended)**
- [ ] On any device, open: `http://verbumcare-server.local:3000/api/config/display`
- [ ] QR code visible
- [ ] Open iOS app on iPad
- [ ] Scan QR code
- [ ] App configured automatically

**Option B: Manual Configuration**
- [ ] Open iOS app settings
- [ ] Enter API URL: `http://verbumcare-server.local:3000/api`
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

3. **Monitor processing:**
   - [ ] Upload completes (~1-2 seconds)
   - [ ] Processing starts (watch for activity if terminals visible)
   - [ ] Results return in 20-30 seconds
   - [ ] No errors displayed

4. **Check memory on M2 during processing:**
   ```bash
   # In another terminal
   while true; do top -l 1 | grep PhysMem; sleep 2; done
   ```
   - [ ] **Peak memory ~85-90%** (expected)
   - [ ] **No "out of memory" warnings**
   - [ ] **Returns to ~50% after processing**

---

### T-2min: Final Checks

**Intel Mac:**
- [ ] Docker containers running (`docker ps` shows 2 containers)
- [ ] No error logs visible
- [ ] Network stable

**M2 Mac:**
- [ ] PowerPoint in presentation mode
- [ ] Can navigate slides smoothly
- [ ] Ollama/Whisper logs show "ready" (if visible)
- [ ] No performance issues

**iPad:**
- [ ] Connected to WiFi
- [ ] App logged in (if required)
- [ ] Battery > 50%
- [ ] Volume appropriate (if audio playback needed)

**Environment:**
- [ ] Projector/screen connected and working
- [ ] M2 Mac screen visible to audience (if showing presentation)
- [ ] All cables secure
- [ ] Room lighting appropriate

---

## 🚨 Emergency Fallbacks

### If network discovery fails:
```bash
# Find M2 Mac IP:
# On M2 Mac:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Update Intel Mac backend/.env with actual IP:
WHISPER_URL=http://192.168.x.x:8080
OLLAMA_URL=http://192.168.x.x:11434

# Restart backend:
docker-compose restart backend
```

### If AI services fail:
- **Backend automatically falls back to mock data**
- Demo continues with synthetic results
- Audience won't notice if you don't mention it

### If M2 Mac runs out of memory:
1. Close PowerPoint temporarily
2. Process the voice recording
3. Reopen PowerPoint
4. Continue demo

### If Docker fails on Intel Mac:
- Restart Docker Desktop
- Re-run `./intel-mac-start.sh`
- Wait 2 minutes

---

## ✅ Ready for Demo!

When all items are checked:
- [ ] **All systems green** ✅
- [ ] **Memory comfortable on both machines** ✅
- [ ] **Network connectivity verified** ✅
- [ ] **End-to-end test successful** ✅
- [ ] **Presenter confident** ✅

**Demo start time:** ________________

**Expected processing time per recording:** 22-30 seconds

**Good luck! 🎯**

---

## 📞 Quick Reference

**Intel Mac Services:**
- Backend API: http://localhost:3000
- Admin Portal: http://localhost:5173
- Dashboard: http://localhost:5174

**M2 Mac Services:**
- Ollama: http://localhost:11434
- Whisper: http://localhost:8080

**Network Names:**
- Intel Mac: `verbumcare-server.local`
- M2 Mac: `verbumcare-ai.local`

**Stop Everything:**
```bash
# Intel Mac:
docker-compose down
pkill -f "npm run dev"

# M2 Mac:
pkill ollama
pkill whisper-server
```