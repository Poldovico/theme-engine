#!/bin/bash

# Docker Compose Demo Setup
# Starts services and initializes demo data

set -e

echo "🎨 Whitelabel Theme Demo - Docker Setup"
echo ""

# Build image

echo "🐳 Building Docker image..."
docker compose build

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for Nginx proxy to be ready
MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
  if curl -sf http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✓ Services are ready"
    break
  fi
  TRIES=$((TRIES + 1))
  if [ $TRIES -eq $MAX_TRIES ]; then
    echo "❌ Services failed to start"
    docker-compose logs
    exit 1
  fi
  sleep 1
done

echo ""

# Run setup script
echo "📋 Initializing demo data..."
API_BASE=http://localhost:8080/api ./setup.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Demo is now running at: http://localhost:8080"
echo ""
echo "Available themes:"
echo "  - Ocean Breeze (light blue theme)"
echo "  - Midnight Purple (dark purple theme)"
echo ""
echo "🛠️  To monitor logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
echo ""
