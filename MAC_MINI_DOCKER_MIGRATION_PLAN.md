# Mac Mini Docker Stack Migration Plan

## Overview

**Migration**: Complete Docker stack from pn51 (x86_64 Linux) → Mac Mini (Apple Silicon macOS)

**Scope**: Environment setup only - NOT retargeting the app yet

**Critical Considerations**:
- Architecture change: x86_64 → arm64 (Apple Silicon)
- OS change: Linux → macOS
- Database migration with zero data loss
- SSL certificate preservation
- Container compatibility

## Current Architecture Analysis

### Source: pn51 (verbumcare-lab.local)
- **OS**: Linux x86_64
- **Docker**: Linux containers
- **Services**: PostgreSQL, Backend API, nginx
- **Database**: ~500MB+ production data
- **SSL**: Self-signed certificates in `/opt/verbumcare/ssl/`
- **Container Names**: `nagare-postgres`, `nagare-backend`, `nagare-nginx`

### Target: Mac Mini (verbumcaremac-mini)
- **OS**: macOS (Apple Silicon)
- **Docker**: Docker Desktop for Mac (arm64)
- **Architecture**: arm64/aarch64
- **User**: vcadmin
- **Existing**: Ollama, Whisper already running

## Phase 1: Pre-Migration Assessment

### 1.1 Mac Mini Environment Audit
```bash
# Check Mac Mini specifications
ssh vcadmin@verbumcaremac-mini "system_profiler SPHardwareDataType"
ssh vcadmin@verbumcaremac-mini "df -h"  # Disk space
ssh vcadmin@verbumcaremac-mini "docker --version || echo 'Docker not installed'"
```

### 1.2 Current pn51 State Backup
```bash
# Database backup
ssh verbumcare-lab.local "docker exec nagare-postgres pg_dump -U nagare -d nagare_db > /tmp/verbumcare_backup_$(date +%Y%m%d_%H%M%S).sql"

# SSL certificates backup
ssh verbumcare-lab.local "tar -czf /tmp/ssl_backup_$(date +%Y%m%d_%H%M%S).tar.gz /opt/verbumcare/ssl/"

# Docker volumes backup
ssh verbumcare-lab.local "docker run --rm -v nagare_postgres_data:/data -v /tmp:/backup alpine tar czf /backup/postgres_data_$(date +%Y%m%d_%H%M%S).tar.gz -C /data ."

# Application files backup
ssh verbumcare-lab.local "tar -czf /tmp/verbumcare_app_$(date +%Y%m%d_%H%M%S).tar.gz -C /home/q verbumcare-demo"
```

### 1.3 Container Compatibility Analysis
- **PostgreSQL**: `postgres:15-alpine` → Need arm64 version
- **Backend**: Custom Node.js → Need to rebuild for arm64
- **nginx**: `nginx:alpine` → Need arm64 version
- **Volumes**: Data migration required

## Phase 2: Mac Mini Environment Setup

### 2.1 Docker Desktop Installation
```bash
# Install Docker Desktop for Mac (arm64)
ssh vcadmin@verbumcaremac-mini "
  # Download Docker Desktop for Apple Silicon
  curl -o ~/Docker.dmg 'https://desktop.docker.com/mac/main/arm64/Docker.dmg'
  
  # Mount and install (requires manual intervention)
  hdiutil attach ~/Docker.dmg
  # Manual: Drag Docker to Applications
  # Manual: Launch Docker Desktop and complete setup
"
```

### 2.2 Directory Structure Creation
```bash
ssh vcadmin@verbumcaremac-mini "
  mkdir -p ~/verbumcare-demo/{backend,nginx,ssl,uploads}
  mkdir -p ~/verbumcare-demo/ssl/{certs,private}
"
```

### 2.3 SSL Certificate Migration
```bash
# Copy SSL certificates from pn51 to Mac Mini
scp verbumcare-lab.local:/opt/verbumcare/ssl/certs/* vcadmin@verbumcaremac-mini:~/verbumcare-demo/ssl/certs/
scp verbumcare-lab.local:/opt/verbumcare/ssl/private/* vcadmin@verbumcaremac-mini:~/verbumcare-demo/ssl/private/
```

## Phase 3: Container Image Preparation

### 3.1 Multi-Architecture Docker Compose
Create `docker-compose.macmini.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    platform: linux/arm64  # Explicit arm64
    container_name: macmini-postgres
    environment:
      POSTGRES_DB: nagare_db
      POSTGRES_USER: nagare
      POSTGRES_PASSWORD: nagare_secure_password_change_me
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./uploads:/uploads
    ports:
      - "5432:5432"
    networks:
      - verbumcare-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.arm64  # New ARM64 Dockerfile
      platform: linux/arm64
    container_name: macmini-backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://nagare:nagare_secure_password_change_me@postgres:5432/nagare_db
      - OLLAMA_URL=http://host.docker.internal:11434  # Use Mac Mini Ollama
      - WHISPER_URL=http://host.docker.internal:8080   # Use Mac Mini Whisper
    volumes:
      - ./uploads:/app/uploads
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    networks:
      - verbumcare-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    platform: linux/arm64
    container_name: macmini-nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/verbumcare-lab.local.conf:/etc/nginx/conf.d/verbumcare-lab.local.conf:ro
      - ./ssl/certs:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - verbumcare-network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  verbumcare-network:
    driver: bridge
```

### 3.2 ARM64 Backend Dockerfile
Create `backend/Dockerfile.arm64`:

```dockerfile
# Use Node.js ARM64 base image
FROM node:18-alpine

# Set platform explicitly
ARG TARGETPLATFORM=linux/arm64

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

## Phase 4: Database Migration Strategy

### 4.1 Database Export from pn51
```bash
# Create comprehensive backup
ssh verbumcare-lab.local "
  # Stop backend to ensure consistency
  docker stop nagare-backend
  
  # Create full database dump
  docker exec nagare-postgres pg_dump -U nagare -d nagare_db \
    --verbose --clean --no-owner --no-privileges \
    > /tmp/verbumcare_full_backup.sql
  
  # Create schema-only dump
  docker exec nagare-postgres pg_dump -U nagare -d nagare_db \
    --schema-only --verbose --clean --no-owner --no-privileges \
    > /tmp/verbumcare_schema_backup.sql
  
  # Create data-only dump
  docker exec nagare-postgres pg_dump -U nagare -d nagare_db \
    --data-only --verbose --no-owner --no-privileges \
    > /tmp/verbumcare_data_backup.sql
  
  # Restart backend
  docker start nagare-backend
"
```

### 4.2 Database Import to Mac Mini
```bash
# Copy database dumps to Mac Mini
scp verbumcare-lab.local:/tmp/verbumcare_*_backup.sql vcadmin@verbumcaremac-mini:~/verbumcare-demo/

# Import on Mac Mini (after containers are running)
ssh vcadmin@verbumcaremac-mini "
  cd ~/verbumcare-demo
  
  # Import full database
  docker exec -i macmini-postgres psql -U nagare -d nagare_db < verbumcare_full_backup.sql
  
  # Verify import
  docker exec macmini-postgres psql -U nagare -d nagare_db -c '\dt'
  docker exec macmini-postgres psql -U nagare -d nagare_db -c 'SELECT COUNT(*) FROM patients;'
"
```

## Phase 5: Network and DNS Configuration

### 5.1 mDNS Setup for Mac Mini
```bash
# Configure Mac Mini to respond to verbumcare-lab.local (for testing)
ssh vcadmin@verbumcaremac-mini "
  # Add local hostname alias (temporary for testing)
  sudo scutil --set LocalHostName verbumcare-macmini
  
  # Configure nginx to handle both hostnames
  # This allows testing without changing client configurations
"
```

### 5.2 nginx Configuration Update
Update nginx config to handle hostname flexibility:

```nginx
server {
    listen 443 ssl http2;
    server_name verbumcare-lab.local verbumcaremac-mini.local localhost;
    
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_private_key /etc/nginx/ssl/nginx.key;
    
    location / {
        proxy_pass http://macmini-backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Phase 6: Migration Execution Scripts

### 6.1 Pre-Migration Checklist Script
```bash
#!/bin/bash
# pre-migration-checklist.sh

echo "🔍 Pre-Migration Checklist for Mac Mini"
echo "======================================="

# Check Mac Mini resources
echo "1. Checking Mac Mini resources..."
ssh vcadmin@verbumcaremac-mini "
  echo 'CPU:' && sysctl -n machdep.cpu.brand_string
  echo 'Memory:' && system_profiler SPHardwareDataType | grep 'Memory:'
  echo 'Disk Space:' && df -h /
  echo 'Docker:' && docker --version
"

# Check pn51 current state
echo "2. Checking pn51 current state..."
ssh verbumcare-lab.local "
  echo 'Docker containers:' && docker ps
  echo 'Database size:' && docker exec nagare-postgres psql -U nagare -d nagare_db -c \"SELECT pg_size_pretty(pg_database_size('nagare_db'));\"
  echo 'SSL certificates:' && ls -la /opt/verbumcare/ssl/certs/
"

echo "✅ Pre-migration checklist complete"
```

### 6.2 Migration Execution Script
```bash
#!/bin/bash
# execute-migration.sh

set -e

echo "🚀 Executing Mac Mini Migration"
echo "==============================="

# Phase 1: Backup pn51
echo "Phase 1: Creating backups..."
./backup-pn51.sh

# Phase 2: Setup Mac Mini
echo "Phase 2: Setting up Mac Mini environment..."
./setup-macmini-environment.sh

# Phase 3: Deploy containers
echo "Phase 3: Deploying containers..."
./deploy-macmini-containers.sh

# Phase 4: Migrate database
echo "Phase 4: Migrating database..."
./migrate-database.sh

# Phase 5: Verify deployment
echo "Phase 5: Verifying deployment..."
./verify-macmini-deployment.sh

echo "✅ Migration execution complete"
```

### 6.3 Rollback Strategy
```bash
#!/bin/bash
# rollback-migration.sh

echo "🔄 Rolling back to pn51"
echo "======================"

# Stop Mac Mini services
ssh vcadmin@verbumcaremac-mini "cd ~/verbumcare-demo && docker-compose -f docker-compose.macmini.yml down"

# Restart pn51 services
ssh verbumcare-lab.local "cd /home/q/verbumcare-demo && docker-compose up -d"

# Verify pn51 is operational
ssh verbumcare-lab.local "curl -k https://localhost/health"

echo "✅ Rollback complete - pn51 is active"
```

## Phase 7: Testing and Validation

### 7.1 Functional Testing Checklist
- [ ] Database connectivity and data integrity
- [ ] Backend API endpoints responding
- [ ] SSL certificates working
- [ ] AI services integration (Ollama/Whisper)
- [ ] File uploads working
- [ ] Authentication working
- [ ] All migrations applied correctly

### 7.2 Performance Comparison
```bash
# Compare performance between pn51 and Mac Mini
./performance-comparison.sh
```

### 7.3 Integration Testing
```bash
# Run full integration test suite
./test-macmini-integration.sh
```

## Phase 8: Documentation and Handover

### 8.1 Updated Documentation
- Update deployment-context.md
- Update tech.md with new architecture
- Create Mac Mini specific operational guides
- Update backup/restore procedures

### 8.2 Operational Procedures
- Container management on macOS
- Database backup/restore on Mac Mini
- SSL certificate renewal process
- Monitoring and logging setup

## Risk Mitigation

### High-Risk Items
1. **Database Migration**: Use transaction-based imports with verification
2. **SSL Certificates**: Test thoroughly before going live
3. **Container Compatibility**: Validate all images work on arm64
4. **Performance**: Monitor resource usage during migration

### Contingency Plans
1. **Immediate Rollback**: Keep pn51 running until Mac Mini is fully validated
2. **Data Loss Prevention**: Multiple backup strategies
3. **Downtime Minimization**: Parallel deployment approach
4. **Communication Plan**: Clear status updates during migration

## Success Criteria

- [ ] All Docker containers running on Mac Mini
- [ ] Database fully migrated with data integrity verified
- [ ] SSL/HTTPS working correctly
- [ ] All API endpoints responding
- [ ] AI services integrated
- [ ] Performance meets or exceeds pn51
- [ ] Complete rollback capability maintained
- [ ] Documentation updated

## Timeline Estimate

- **Phase 1-2**: 2-3 hours (Assessment & Setup)
- **Phase 3-4**: 3-4 hours (Container & Database Migration)
- **Phase 5-6**: 2-3 hours (Network & Execution)
- **Phase 7**: 2-3 hours (Testing & Validation)
- **Phase 8**: 1-2 hours (Documentation)

**Total**: 10-15 hours (spread over multiple days for safety)

## Implementation Status

✅ **COMPLETED**: All migration scripts and configurations have been implemented:

### Created Files:
- `backend/Dockerfile.arm64` - ARM64 backend container
- `nginx/verbumcare-macmini.conf` - Mac Mini nginx configuration  
- `docker-compose.macmini.yml` - ARM64 Docker Compose setup
- `pre-migration-checklist.sh` - Pre-migration verification
- `backup-pn51.sh` - Comprehensive pn51 backup
- `setup-macmini-environment.sh` - Mac Mini environment setup
- `deploy-macmini-containers.sh` - Container deployment
- `migrate-database.sh` - Database migration with verification
- `verify-macmini-deployment.sh` - Comprehensive testing
- `rollback-migration.sh` - Safe rollback to pn51

### Ready for Execution:
1. **Phase 1**: Run `./pre-migration-checklist.sh`
2. **Phase 2**: Run `./backup-pn51.sh` 
3. **Phase 3**: Run `./setup-macmini-environment.sh`
4. **Phase 4**: Run `./deploy-macmini-containers.sh`
5. **Phase 5**: Run `./migrate-database.sh`
6. **Phase 6**: Run `./verify-macmini-deployment.sh`
7. **Rollback**: Run `./rollback-migration.sh` if needed

**Note**: This sets up the environment only. App retargeting to the new server will be a separate phase after validation.