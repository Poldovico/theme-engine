#!/bin/bash

# Demo Setup Script
# This script populates a fresh Whitelabel server with sample data

set -e

API_BASE="${API_BASE:-http://localhost:8080/api}"

echo "🎨 Setting up Whitelabel Theme Demo"
echo "API Base: $API_BASE"
echo ""

# Check if server is running
echo "✓ Checking server health..."
if ! curl -sf "$API_BASE/health" > /dev/null; then
  echo "❌ Error: Server at $API_BASE is not responding"
  echo "   Please start the server first: npm start"
  exit 1
fi
echo "✓ Server is running"
echo ""

# Create schema
echo "📋 Creating schema..."
SCHEMA_RESPONSE=$(curl -sf -X POST "$API_BASE/schemas" \
  -H "Content-Type: application/json" \
  -d @schema.json)

SCHEMA_ID=$(echo "$SCHEMA_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SCHEMA_ID" ]; then
  echo "❌ Error: Failed to create schema"
  echo "$SCHEMA_RESPONSE"
  exit 1
fi

echo "✓ Schema created: $SCHEMA_ID"
echo ""

# Create Ocean theme
echo "🌊 Creating Ocean Breeze theme..."
OCEAN_JSON=$(cat theme-ocean.json | sed "s/SCHEMA_ID_PLACEHOLDER/$SCHEMA_ID/")
OCEAN_RESPONSE=$(curl -sf -X POST "$API_BASE/themes" \
  -H "Content-Type: application/json" \
  -d "$OCEAN_JSON")

OCEAN_ID=$(echo "$OCEAN_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$OCEAN_ID" ]; then
  echo "❌ Error: Failed to create Ocean theme"
  echo "$OCEAN_RESPONSE"
  exit 1
fi

echo "✓ Ocean Breeze theme created: $OCEAN_ID"
echo ""

# Create Midnight theme
echo "🌙 Creating Midnight Purple theme..."
MIDNIGHT_JSON=$(cat theme-midnight.json | sed "s/SCHEMA_ID_PLACEHOLDER/$SCHEMA_ID/")
MIDNIGHT_RESPONSE=$(curl -sf -X POST "$API_BASE/themes" \
  -H "Content-Type: application/json" \
  -d "$MIDNIGHT_JSON")

MIDNIGHT_ID=$(echo "$MIDNIGHT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MIDNIGHT_ID" ]; then
  echo "❌ Error: Failed to create Midnight theme"
  echo "$MIDNIGHT_RESPONSE"
  exit 1
fi

echo "✓ Midnight Purple theme created: $MIDNIGHT_ID"
echo ""

# Summary
echo "✅ Setup complete!"
echo ""
echo "Theme IDs:"
echo "  - Ocean Breeze:    $OCEAN_ID"
echo "  - Midnight Purple: $MIDNIGHT_ID"
echo ""
echo "📚 Next steps:"
echo "  1. Open http://localhost:8080 in your browser"
echo "  2. Select a theme from the dropdown"
echo "  3. Click 'Toggle Editor' to customize the theme"
echo "  4. View rendered CSS at:"
echo "     http://localhost:8080/api/render/$OCEAN_ID.css"
echo "     http://localhost:8080/api/render/$MIDNIGHT_ID.css"
echo ""
