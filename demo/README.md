# 🎨 Whitelabel Theme Demo

This demo showcases the Whitelabel theming system with a live webpage and interactive theme editor.

## Features

- **Dynamic Theme Switching**: Load and apply different themes in real-time
- **Live Theme Editor**: Edit theme variables with visual controls
- **Type Support**: Color pickers, gradient editors, and text inputs
- **CSS Rendering**: Themes render to standard CSS custom properties
- **Sample Content**: See themes applied to real UI components

## Quick Start

### Docker Setup (Recommended)

The easiest way to run the demo is with Docker Compose:

```bash
chmod +x start.sh
./start.sh
```

Then open **<http://localhost:8080>** in your browser.

This starts all services (Valkey, API, Nginx) and initializes demo data automatically.

See **QUICKSTART.md** and **DOCKER.md** for details.

### Manual Setup

If you're running the API and Valkey separately:

```bash
chmod +x setup.sh
./setup.sh
```

This will create:

- 1 schema with color, gradient, and string variables
- 2 themes: "Ocean Breeze" (light) and "Midnight Purple" (dark)

Then open the demo in your browser:

- **With Docker**: http://localhost:8080
- **Manual setup**: Open `index.html` directly (requires API server running and accessible)

**Note:** When using Docker, all API access goes through the Nginx proxy - Valkey and the API do not expose ports directly.

### How It Works

The page will:

1. Load available themes from the API
2. Apply the selected theme's CSS
3. Display sample content using theme variables
4. Provide an editor to modify theme variables

## File Structure

```
demo/
├── schema.json          # Theme schema definition
├── theme-ocean.json     # Light theme (ocean colors)
├── theme-midnight.json  # Dark theme (purple/pink)
├── index.html           # Demo webpage with editor
├── setup.sh             # Data initialization script
├── start.sh             # Docker start script
├── reset.sh             # Docker reset script
├── docker-compose.yml   # Docker orchestration
├── nginx.conf           # Nginx proxy configuration
├── QUICKSTART.md        # Quick start guide
├── DOCKER.md            # Docker documentation
└── README.md            # This file
```

## Schema Variable Types

### Color

- Renders as color picker + hex input
- Example: `--primary-color: #3b82f6`

### Gradient

- Two-color linear gradient (135deg)
- Renders as two color pickers with live preview
- Example: `--header-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)`

### String

- Generic text input
- Used for fonts, sizes, spacing, etc.
- Example: `--font-family: system-ui, sans-serif`

## API Endpoints Used

- `GET /themes` - List all themes
- `GET /themes/:id` - Get theme details
- `GET /schemas/:id` - Get schema definition
- `PUT /themes/:id/variables/:name` - Update variable
- `GET /render/:themeId.css` - Get rendered CSS

## Manual Setup (Alternative)

**With Docker (through proxy):**

```bash
# Ensure services are running
cd demo && docker-compose up -d

# Initialize data through proxy
API_BASE=http://localhost:8080/api ./setup.sh
```

**Without Docker (direct API):**

If running the API separately on port 3000:

```bash
# 1. Create schema
SCHEMA_ID=$(curl -X POST http://localhost:3000/schemas \
  -H "Content-Type: application/json" \
  -d @schema.json | jq -r .id)

# 2. Create Ocean theme
sed "s/SCHEMA_ID_PLACEHOLDER/$SCHEMA_ID/" theme-ocean.json | \
  curl -X POST http://localhost:3000/themes \
  -H "Content-Type: application/json" \
  -d @-

# 3. Create Midnight theme
sed "s/SCHEMA_ID_PLACEHOLDER/$SCHEMA_ID/" theme-midnight.json | \
  curl -X POST http://localhost:3000/themes \
  -H "Content-Type: application/json" \
  -d @-
```

## Customization

### Add More Themes

1. Create a new JSON file (e.g., `theme-custom.json`)
2. Reference the schema ID
3. Define variable overrides
4. POST to `/themes`

### Modify Schema

Edit `schema.json` to add/remove variables. Supported types:

- `color` - Color picker
- `gradient` - Two-color gradient editor
- `string` - Text input

### Extend the Demo

The `index.html` file uses vanilla JavaScript and can be easily extended:

- Add more sample components
- Implement theme export/import
- Add validation
- Integrate with your own UI framework

## Troubleshooting

**Themes not loading?**

- With Docker: Check services are running: `docker-compose ps`
- Check the API through proxy: `curl http://localhost:8080/api/health`
- Check browser console for errors
- Without Docker: Ensure API is running and accessible

**Setup script fails?**

- Ensure you're in the `demo/` directory
- Check that `jq` is not required (script uses grep instead)
- Run with bash: `bash setup.sh`

**Editor not showing?**

- Click "Toggle Editor" button
- Select a theme first
- Check browser console for errors

## Notes

This is a demonstration/sample implementation:

- Not production-ready
- No error handling for network failures
- No input validation
- Assumes fresh server state
- Uses naive parsing for gradients
- No authentication/authorization
