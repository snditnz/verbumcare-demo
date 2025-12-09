---
inclusion: always
---

# Deployment Context

## Critical Infrastructure Information

### Docker Services Location
**ALL Docker services run on a REMOTE SERVER, NOT locally.**

- **Remote Server**: verbumcare-lab.local (also known as pn51-e1)
- **SSH Access**: Available via `ssh verbumcare-lab.local`
- **PostgreSQL Database**: Running in Docker on remote server
  - **Host**: verbumcare-lab.local:5432
  - **Database**: nagare_db
  - **User**: nagare
  - **Password**: nagare_secure_password_change_me
  - **Connection String**: `postgres://nagare:nagare_secure_password_change_me@verbumcare-lab.local:5432/nagare_db`
- **Backend API**: Running in Docker on remote server
- **Database Connection**: Tests and services connect to remote PostgreSQL, **NEVER localhost**

### Testing Implications
- Property-based tests that require database access will fail if Docker services are not running on the remote server
- Database connection errors (AggregateError from pg-pool) indicate the remote Docker services are down
- Before running backend tests, verify Docker services are running on the remote server

### Common Commands for Remote Server

**SSH into remote server first:**
```bash
ssh verbumcare-lab.local
```

**Then run Docker commands on the remote server:**
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
# Check Docker status from local machine
ssh verbumcare-lab.local "cd /path/to/project && docker-compose ps"

# Start services from local machine
ssh verbumcare-lab.local "cd /path/to/project && docker-compose up -d"
```

### When Tests Fail with Database Errors
If you see errors like:
- `AggregateError` from `pg-pool`
- Connection refused to PostgreSQL
- Database connection timeouts

**Action Required**: Ask the user to start Docker services on the remote server before running tests that require database access.

### Local vs Remote
- **iPad App**: Runs locally on development machine (connects to remote API)
- **Admin Portal**: Runs locally on development machine (connects to remote API)
- **Backend API**: Runs in Docker on REMOTE server
- **PostgreSQL**: Runs in Docker on REMOTE server
- **AI Services** (Ollama, Whisper): Run on REMOTE server

Always confirm Docker services are running on the remote server before attempting to run backend tests or database operations.
