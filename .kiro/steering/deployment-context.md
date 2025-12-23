---
inclusion: always
---

# Deployment Context

## Critical Infrastructure Information

### Server Infrastructure
**VerbumCare runs on multiple remote servers, NOT locally.**

#### Primary Production Server (Mac Mini) - CURRENT PRODUCTION
- **Hostname**: verbumcarenomac-mini.local
- **SSH Access**: `ssh vcadmin@verbumcarenomac-mini.local`
- **Services**: PostgreSQL, Backend API, nginx reverse proxy, Ollama (LLM), Whisper (Speech-to-Text)
- **Docker Services**: All production services run here
- **OS**: macOS (optimized for Metal GPU acceleration)
- **Status**: ✅ ACTIVE PRODUCTION SERVER
- **Auto-Start**: ✅ Configured with LaunchAgent for reliability

#### Legacy Server (pn51-e1) - ROLLBACK AVAILABLE
- **Hostname**: verbumcare-lab.local (also known as pn51-e1)
- **SSH Access**: `ssh verbumcare-lab.local`
- **Services**: PostgreSQL, Backend API, nginx reverse proxy, Ollama (LLM), Whisper (Speech-to-Text)
- **Purpose**: Legacy production server, available for rollback
- **Status**: ⚠️ STANDBY (available for rollback if needed)

### Docker Services Location
**ALL Docker services run on REMOTE SERVERS, NOT locally.**

#### Current Production (Mac Mini)
- **PostgreSQL Database**: Running in Docker on verbumcarenomac-mini.local
  - **Host**: verbumcarenomac-mini.local:5432
  - **Database**: nagare_db
  - **User**: nagare
  - **Password**: nagare_secure_password_change_me
  - **Connection String**: `postgres://nagare:nagare_secure_password_change_me@verbumcarenomac-mini.local:5432/nagare_db`
- **Backend API**: Running in Docker on verbumcarenomac-mini.local
- **AI Services**: Running on verbumcarenomac-mini.local (Mac Mini)
  - **Ollama**: `http://verbumcarenomac-mini.local:11434`
  - **Whisper**: `http://verbumcarenomac-mini.local:8080`

#### Legacy/Rollback (pn51)
- **PostgreSQL Database**: Available on verbumcare-lab.local (for rollback)
  - **Host**: verbumcare-lab.local:5432
  - **Database**: nagare_db
  - **User**: nagare
  - **Connection String**: `postgres://nagare:nagare_secure_password_change_me@verbumcare-lab.local:5432/nagare_db`
- **Backend API**: Available on verbumcare-lab.local (for rollback)
- **AI Services**: Available on verbumcare-lab.local (pn51)
  - **Ollama**: `http://verbumcare-lab.local:11434`
  - **Whisper**: `http://verbumcare-lab.local:8080`

- **Database Connection**: Tests and services connect to remote PostgreSQL, **NEVER localhost**

### Testing Implications
- Property-based tests that require database access will fail if Docker services are not running on the remote server
- Database connection errors (AggregateError from pg-pool) indicate the remote Docker services are down
- **Current Production**: Before running backend tests, verify Docker services are running on verbumcarenomac-mini.local
- **Legacy/Rollback**: pn51 services available on verbumcare-lab.local for rollback testing

### Common Commands for Remote Servers

#### Current Production Server (Mac Mini)
**SSH into Mac Mini:**
```bash
ssh vcadmin@verbumcarenomac-mini.local
```

**Docker commands on Mac Mini:**
```bash
# Check if Docker services are running
export PATH=/Applications/Docker.app/Contents/Resources/bin:$PATH
cd ~/verbumcare-demo
docker compose -f docker-compose.macmini.yml ps

# Start Docker services
docker compose -f docker-compose.macmini.yml up -d

# View logs
docker compose -f docker-compose.macmini.yml logs -f backend
docker compose -f docker-compose.macmini.yml logs -f postgres

# Stop services
docker compose -f docker-compose.macmini.yml down

# Restart services
docker compose -f docker-compose.macmini.yml restart
```

**AI service commands on Mac Mini:**
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Check Whisper status
curl http://localhost:8080/health

# Check running processes
ps aux | grep -E "(ollama|whisper)"
```

#### Legacy Server (pn51) - For Rollback
**SSH into legacy server:**
```bash
ssh verbumcare-lab.local
```

**Docker commands on legacy server:**
```bash
# Check if Docker services are running
docker-compose ps

# Start Docker services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Stop services
docker-compose down
```

**Or run commands directly via SSH:**
```bash
# Check AI services on Mac Mini (current production)
ssh vcadmin@verbumcarenomac-mini.local "curl -s http://localhost:11434/api/tags"
ssh vcadmin@verbumcarenomac-mini.local "curl -s http://localhost:8080/health"

# Check Docker status on Mac Mini (current production)
ssh vcadmin@verbumcarenomac-mini.local "export PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && cd ~/verbumcare-demo && docker compose -f docker-compose.macmini.yml ps"

# Check AI services on pn51 (legacy/rollback)
ssh verbumcare-lab.local "curl -s http://localhost:11434/api/tags"
ssh verbumcare-lab.local "curl -s http://localhost:8080/health"

# Check Docker status on pn51 (legacy/rollback)
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker-compose ps"
```

### When Tests Fail with Database or AI Service Errors
If you see errors like:
- `AggregateError` from `pg-pool`
- Connection refused to PostgreSQL
- Database connection timeouts
- Ollama connection errors
- Whisper service unavailable

**Action Required**: 
1. **Database issues**: Ask the user to start Docker services on verbumcarenomac-mini.local (current production)
2. **AI service issues**: Ask the user to start AI services on verbumcarenomac-mini.local (current production)
3. **Legacy services**: pn51 services available on verbumcare-lab.local for rollback if needed

### Local vs Remote Services
- **iPad App**: Runs locally on development machine (connects to remote APIs)
- **Admin Portal**: Runs locally on development machine (connects to remote APIs)
- **Backend API**: Runs in Docker on verbumcarenomac-mini.local (current production)
- **PostgreSQL**: Runs in Docker on verbumcarenomac-mini.local (current production)
- **Ollama (LLM)**: Runs on verbumcarenomac-mini.local (current production)
- **Whisper (STT)**: Runs on verbumcarenomac-mini.local (current production)
- **Legacy Services**: All services available on verbumcare-lab.local (pn51) for rollback

### Network Configuration
- **Current Production**: verbumcarenomac-mini.local (Mac Mini M2)
- **Legacy/Rollback**: verbumcare-lab.local (pn51-e1)
- **Backend connects to AI services**: Uses verbumcarenomac-mini.local:11434 and verbumcarenomac-mini.local:8080 (current production)
- **Client apps connect to backend**: Uses verbumcarenomac-mini.local:443 (HTTPS) - **UPDATE REQUIRED**
- **Legacy endpoints**: verbumcare-lab.local available for rollback

Always confirm Docker services are running on verbumcarenomac-mini.local before attempting to run backend tests or database operations. Legacy pn51 services are available for rollback if needed.
