#!/bin/bash

# Quick demo reset - stops services, clears data, and restarts fresh

set -e

echo "🔄 Resetting Whitelabel Demo..."
echo ""

# Stop services
echo "🛑 Stopping services..."
docker-compose down -v

echo ""
echo "🐳 Starting fresh services..."
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
    exit 1
  fi
  sleep 1
done

echo ""
echo "📋 Initializing demo data..."
API_BASE=http://localhost:8080/api ./setup.sh

echo ""
echo "✅ Reset complete! Open http://localhost:8080"
echo ""
