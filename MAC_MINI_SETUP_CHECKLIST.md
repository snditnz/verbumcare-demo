# Mac Mini Setup Checklist for VerbumCare

## 🖥️ **INITIAL MAC MINI CONFIGURATION**

### ✅ **System Setup**
- [ ] Complete macOS setup wizard
- [ ] Create admin user account (remember username for migration)
- [ ] Connect to network (same network as pn51)
- [ ] Enable SSH: System Preferences > Sharing > Remote Login
- [ ] Set hostname: System Preferences > Sharing > Computer Name
- [ ] Install Xcode Command Line Tools: `xcode-select --install`

### ✅ **Docker Installation**
- [ ] Download Docker Desktop from https://www.docker.com/products/docker-desktop
- [ ] Install Docker Desktop
- [ ] Start Docker Desktop
- [ ] Verify installation: `docker --version && docker compose version`

### ✅ **Development Tools**
- [ ] Install Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- [ ] Install Node.js: `brew install node`
- [ ] Install Git: `brew install git`
- [ ] Install curl: `brew install curl` (if not already installed)

### ✅ **Network Configuration**
- [ ] Set static IP (optional but recommended)
- [ ] Configure mDNS hostname (e.g., verbumcare-lab-2.local)
- [ ] Test network connectivity to pn51: `ping verbumcare-lab.local`

### ✅ **SSH Key Setup**
- [ ] Generate SSH key: `ssh-keygen -t rsa -b 4096`
- [ ] Copy public key to pn51: `ssh-copy-id q@verbumcare-lab.local`
- [ ] Test SSH to pn51: `ssh verbumcare-lab.local`

### ✅ **Directory Structure**
- [ ] Create project directory: `mkdir -p ~/verbumcare-demo`
- [ ] Set proper permissions: `chmod 755 ~/verbumcare-demo`

## 🔧 **VERIFICATION COMMANDS**

Run these to verify your Mac Mini is ready:

```bash
# System info
uname -a
whoami
hostname

# Docker verification
docker --version
docker compose version
docker run hello-world

# Network verification
ping -c 3 verbumcare-lab.local
ssh verbumcare-lab.local "echo 'SSH working'"

# Development tools
node --version
npm --version
git --version
```

## 📝 **INFORMATION TO COLLECT**

Write down these details for the migration:

- **New server hostname**: ________________
- **Admin username**: ____________________
- **Project directory**: ___________________
- **IP address**: _________________________

## 🚀 **READY FOR MIGRATION**

When all items are checked, you're ready to run:
```bash
./migrate-to-new-server.sh
```

## 🔍 **TROUBLESHOOTING**

### SSH Issues
- Ensure Remote Login is enabled in System Preferences > Sharing
- Check firewall settings: System Preferences > Security & Privacy > Firewall
- Verify SSH service: `sudo systemsetup -getremotelogin`

### Docker Issues
- Restart Docker Desktop if commands fail
- Check Docker Desktop is running in menu bar
- Verify Docker daemon: `docker info`

### Network Issues
- Check both machines are on same network
- Verify mDNS resolution: `dns-sd -B _ssh._tcp`
- Test with IP address if hostname fails

---
**Status**: ⏳ PREPARING MAC MINI  
**Next Step**: Run migration script when ready