# Nagare Edge Server - systemd Service Configuration

Configuration for Ollama and Whisper services on Ubuntu.

---

## Ollama Service

**Location**: `/etc/systemd/system/ollama.service`

```ini
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
ExecStart=/usr/local/bin/ollama serve
User=ollama
Group=ollama
Restart=always
RestartSec=3
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=default.target
```

**Override**: `/etc/systemd/system/ollama.service.d/override.conf`

```ini
[Service]
Environment="OLLAMA_NUM_THREAD=6"
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

**Critical**: `OLLAMA_HOST=0.0.0.0:11434` makes Ollama accessible from Docker containers via the gateway IP.

### Management

```bash
# Edit configuration
sudo systemctl edit ollama

# Restart
sudo systemctl restart ollama

# Check status
sudo systemctl status ollama

# View logs
sudo journalctl -u ollama -f

# Verify listening on all interfaces
sudo ss -tlnp | grep 11434
# Should show: 0.0.0.0:11434
```

---

## Whisper Service

**Location**: `/etc/systemd/system/whisper-api.service` (example)

```ini
[Unit]
Description=Whisper Fast API Service
After=network-online.target

[Service]
Type=simple
User=q
Group=q
WorkingDirectory=/opt/verbumcare/services/whisper
Environment="PATH=/home/q/whisper-fast-env/bin:/usr/bin:/bin"
ExecStart=/home/q/whisper-fast-env/bin/python3 whisper_server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Management

```bash
# Start/stop
sudo systemctl start whisper-api
sudo systemctl stop whisper-api

# Enable on boot
sudo systemctl enable whisper-api

# Status
sudo systemctl status whisper-api

# Logs
sudo journalctl -u whisper-api -f
```

---

## Docker Network Configuration

**Gateway IP**: Find with:
```bash
docker network inspect verbumcare_nagare-network | grep Gateway
# Returns: 172.18.0.1
```

**Environment Variables** (`.env` in project root):

```bash
OLLAMA_URL=http://172.18.0.1:11434
WHISPER_URL=http://172.18.0.1:8080
```

---

## Troubleshooting

### Ollama not accessible from Docker

**Symptom**: `connect ECONNREFUSED 172.18.0.1:11434`

**Fix**: Ensure Ollama listens on `0.0.0.0`:
```bash
sudo systemctl edit ollama
# Add: Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl restart ollama
curl http://172.18.0.1:11434/api/tags  # Should work
```

### Whisper not starting

**Check**:
```bash
sudo systemctl status whisper-api
sudo journalctl -u whisper-api -n 50
```

Common issues:
- Python virtual environment path wrong
- Model files not downloaded
- Port 8080 already in use

---

## Health Checks

```bash
# Ollama
curl http://172.18.0.1:11434/api/tags

# Whisper
curl http://172.18.0.1:8080/health

# From Docker container
docker exec nagare-backend wget -qO- http://172.18.0.1:11434/api/tags
docker exec nagare-backend wget -qO- http://172.18.0.1:8080/health
```

---

## Performance Tuning

### Ollama

```bash
sudo systemctl edit ollama
```

Add/modify:
```ini
[Service]
Environment="OLLAMA_NUM_THREAD=8"        # Match CPU cores
Environment="OLLAMA_NUM_GPU=1"           # If GPU available
Environment="OLLAMA_MAX_LOADED_MODELS=2" # Concurrent models
```

### Whisper

Adjust in your whisper_server.py or service config:
- Model size: `tiny`, `base`, `small`, `medium`, `large-v3`
- Device: `cpu`, `cuda`
- Compute type: `int8`, `float16`, `float32`

---

## Startup Order

1. **Ollama** - Starts automatically on boot
2. **Whisper** - Starts automatically on boot
3. **Docker services** - Start manually or via startup script

```bash
# Start all
sudo systemctl start ollama whisper-api
docker compose -f docker-compose.nagare.yml up -d
```

---

## Security Notes

- Services listen on `0.0.0.0` for Docker access
- No authentication configured (LAN-only deployment)
- For production: Add firewall rules, authentication, TLS

```bash
# Restrict to Docker bridge only (if needed)
sudo ufw allow from 172.18.0.0/16 to any port 11434
sudo ufw allow from 172.18.0.0/16 to any port 8080
```
