# 🐳 Docker Compose Setup

This Docker Compose configuration provides a complete, self-contained demo environment for the Whitelabel theme system.

## Services

- **Valkey** - In-memory data store (internal network only, no persistence)
- **Whitelabel API** - Theme management API (internal network only)
- **Nginx** (port 8080) - Serves demo UI and proxies API requests

## Quick Start

```bash
# Make scripts executable
chmod +x start.sh

# Start everything and initialize demo data
./start.sh
```

Then open http://localhost:8080 in your browser.

## Manual Setup

If you prefer to control each step:

```bash
# 1. Build and start services
docker-compose up -d

# 2. Wait for services to be healthy (about 10 seconds)
docker-compose ps

# 3. Initialize demo data
./setup.sh

# 4. Open http://localhost:8080
```

## Architecture

```
Browser (http://localhost:8080)
    ↓
Nginx Container
    ├─ / → Serves demo/index.html
    └─ /api/* → Proxies to whitelabel-api:3000/*
        ↓
    Whitelabel API Container
        ↓
    Valkey Container
```

All API calls from the browser use relative paths (`/api/*`), which Nginx proxies to the backend, eliminating CORS issues.

## Management Commands

```bash
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f whitelabel-api
docker-compose logs -f nginx

# Restart a service
docker-compose restart whitelabel-api

# Stop all services
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build
```

## Ports

- `8080` - Nginx (demo UI and API proxy)

**Note:** Valkey and the Whitelabel API do not expose ports to the host. All API access goes through the Nginx proxy at `/api/*`.

## Environment Variables

Configure in `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - VALKEY_HOST=valkey
  - VALKEY_PORT=6379
```

## Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Should show all services as "healthy"
```

## Development Workflow

For development, you may want to run the API and Valkey locally without Docker:

```bash
# Run Valkey locally or use a managed instance
valkey-server

# Run API locally
npm run dev

# Open index.html in browser with API_BASE pointing to localhost:3000
```

Or run only Valkey in Docker and everything else locally:

```bash
# Run only Valkey in Docker
docker run -d -p 6379:6379 valkey/valkey:9.0-alpine valkey-server

# Run API locally (will connect to Docker Valkey)
VALKEY_HOST=localhost npm run dev
```

## Troubleshooting

**Services won't start:**
```bash
# Check logs
docker-compose logs

# Check if port is already in use
lsof -i :8080
```

**API returns errors:**
```bash
# Check Valkey connection from within container
docker-compose exec valkey valkey-cli ping
# Should return: PONG

# Check API health through proxy
curl http://localhost:8080/api/health
# Should return: {"status":"ok","valkey":"ok"}
```

**Demo page shows errors:**
```bash
# Check Nginx is proxying correctly
curl http://localhost:8080/api/health

# Check browser console for JavaScript errors
```

**Need fresh data:**
```bash
# Restart with clean Valkey
docker-compose restart valkey

# Re-run setup
./setup.sh
```

## Production Considerations

This setup is for **demonstration only**. For production:

1. **Add persistence** - Mount Valkey volume or use managed Redis
2. **Enable TLS** - Configure Nginx with SSL certificates
3. **Add authentication** - Protect API endpoints
4. **Resource limits** - Set memory/CPU limits in docker-compose.yml
5. **Monitoring** - Add health check endpoints and metrics
6. **Logging** - Configure structured logging and aggregation
7. **Secrets management** - Use Docker secrets or env file
8. **Multi-stage builds** - Already done in Dockerfile
9. **Security scanning** - Scan images for vulnerabilities
10. **Backup strategy** - Regular Valkey snapshots or replication

## Cleaning Up

```bash
# Stop and remove everything
docker-compose down

# Remove images too
docker-compose down --rmi all

# Remove everything including volumes
docker-compose down -v --rmi all
```
