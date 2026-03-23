# 🎨 Whitelabel Theme Management System

A comprehensive theming system with schema-based validation, CSS rendering, and dynamic theme management.

## Features

- **Schema-based Themes**: Define variable schemas with types and defaults
- **CSS Rendering**: Themes compile to CSS custom properties
- **REST API**: Full CRUD operations for themes and schemas
- **Type Support**: Colors, gradients, and custom values
- **OpenAPI Documentation**: Interactive API docs at `/docs`
- **Real-time Updates**: Live theme editing and preview

## Quick Start

### Try the Demo

```bash
cd demo
./start.sh
```

Then open **<http://localhost:8080>** for an interactive demo with live theme editing.

See `demo/QUICKSTART.md` for details.

### Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

## Architecture

- **Storage**: Valkey (Redis-compatible) for themes and schemas
- **API**: Fastify v5 with TypeScript
- **Testing**: Node.js built-in test runner
- **Types**: Strict TypeScript with comprehensive type safety

## API Endpoints

### Themes

- `GET /themes` - List all themes
- `POST /themes` - Create theme
- `GET /themes/:id` - Get theme details
- `PUT /themes/:id` - Update theme
- `DELETE /themes/:id` - Delete theme
- `POST /themes/:id/clone` - Clone theme
- `GET /themes/:id/variables/:name` - Get variable
- `PUT /themes/:id/variables/:name` - Set variable
- `DELETE /themes/:id/variables/:name` - Delete variable

### Schemas

- `GET /schemas` - List all schemas
- `POST /schemas` - Create schema
- `GET /schemas/:id` - Get schema
- `PUT /schemas/:id` - Update schema
- `DELETE /schemas/:id` - Delete schema (protected)

### Rendering

- `GET /render/:themeId.css` - Get compiled CSS

### Documentation

- `GET /docs` - Swagger UI
- `GET /health` - Health check

## Project Structure

```
src/
├── server.ts                 # Entry point
├── app.ts                    # App factory
├── storage/
│   ├── ValKeyClient.ts       # Valkey connection
│   ├── ThemeRepository.ts    # Theme storage
│   └── SchemaRepository.ts   # Schema storage
├── services/
│   ├── ThemeService.ts       # Theme business logic
│   ├── SchemaService.ts      # Schema business logic
│   └── RenderService.ts      # CSS generation
├── routes/
│   ├── themes.ts             # Theme endpoints
│   ├── schemas.ts            # Schema endpoints
│   └── render.ts             # CSS rendering
└── integration/
    └── api.test.ts           # E2E tests

demo/                         # Interactive demo
├── docker-compose.yml        # Full stack setup
├── start.sh                  # Demo launcher
├── index.html                # Theme editor UI
└── ...

Dockerfile                    # Production image
```

## Environment Variables

```bash
VALKEY_HOST=localhost         # Valkey host
VALKEY_PORT=6379              # Valkey port
NODE_ENV=development          # Environment
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/services/ThemeService.test.ts

# Run with coverage
npm test -- --coverage
```

## Documentation

- **`demo/QUICKSTART.md`** - Get started with Docker demo
- **`demo/DOCKER.md`** - Docker setup details
- **`demo/README.md`** - Demo features and usage
- **`DESIGN_GUIDELINES.md`** - Architecture decisions

## License

[Your License Here]
