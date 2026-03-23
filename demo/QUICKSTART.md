# 🚀 Quick Start - Docker Demo

## One-Command Setup

```bash
./start.sh
```

Then open **<http://localhost:8080>** in your browser.

## What This Does

1. Starts three Docker containers:
   - **Valkey** - Fresh in-memory database
   - **Whitelabel API** - Theme management backend
   - **Nginx** - Web server + API proxy

2. Creates demo data:
   - 1 schema with 9 variables (colors, gradients, strings)
   - 2 themes (Ocean Breeze, Midnight Purple)

3. Serves the demo at <http://localhost:8080>

## Usage

### Start Demo

```bash
./start.sh
```

### Reset Everything

```bash
./reset.sh
```

### Stop Demo

```bash
docker-compose down
```

### View Logs

```bash
docker-compose logs -f
```

## Features

- ✅ No CORS issues (Nginx proxies API)
- ✅ No manual configuration needed
- ✅ Fresh data every time
- ✅ Isolated environment
- ✅ One command to rule them all

## Ports

- **8080** - Demo UI and API (via Nginx proxy)

**Note:** The API and Valkey only communicate on the internal Docker network. All external access goes through Nginx.

## Architecture

```
http://localhost:8080
    ↓
[Nginx Container]
    ├─ / → demo/index.html
    └─ /api/* → http://whitelabel-api:3000/*
        ↓
    [Whitelabel API Container]
        ↓
    [Valkey Container]
```

## Troubleshooting

```bash
# Check service status
docker-compose ps

# Check if port is available
lsof -i :8080

# View container logs
docker-compose logs whitelabel-api
docker-compose logs nginx

# Rebuild after code changes
docker-compose up -d --build
```

## More Details

See **DOCKER.md** for comprehensive documentation.
