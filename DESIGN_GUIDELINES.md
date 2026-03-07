# Whitelabel Theming Engine - Agent Guidelines

## System Overview
A whitelabel theming engine that stores and serves CSS custom properties (variables) as themes. Each theme is a collection of variables that can be retrieved as a CSS stylesheet or manipulated via JSON API.

## Core Concepts

### Theme
- A collection of CSS variables (custom properties) with their values
- Must be identifiable (unique name or ID)
- Can be rendered as a valid CSS stylesheet
- Multiple themes can coexist in the system

### Schema
- Optional metadata structure that defines the variables a theme should contain
- Expressed as plain JSON
- Maps variable names to built-in metadata (type, description) and custom metadata expectations
- Defines constraints like default values, required fields, and validation rules
- Acts as a contract/template for themes
- A theme may reference a schema, but can also exist independently

### CSS Variable
- Name (e.g., `--primary-color`, `--font-size-base`)
- Value (e.g., `#3498db`, `16px`)
- Built-in metadata: `type` and `description` (for theme editor form generation)
- Custom metadata: flexible JSON object for downstream app-specific needs
- Lifecycle tracking: `lastModified` timestamp

### Metadata Architecture

The system distinguishes between two categories of metadata:

**Built-in Metadata**
- Predictable fields that the theming engine recognizes and can use
- Designed to support common use cases like dynamic form generation in theme editors
- Fields:
  - `description`: Human-readable explanation of the variable's purpose
  - `type`: Variable type hint (e.g., `color`, `dimension`, `font`, `number`, `string`)
  - Lifecycle timestamps: `createdAt`, `updatedAt` (theme/schema level), `lastModified` (variable level)

**Custom Metadata**
- The `custom` field accepts any arbitrary JSON object
- Downstream applications can store whatever metadata they need
- Common use cases:
  - Categorization schemes (`category`, `group`, `section`)
  - Editor UI hints (`controlType`, `editorWidget`, `showInPanel`)
  - Business logic (`deprecated`, `internal`, `requiredRole`)
  - Display options (`icon`, `order`, `hidden`)
- No validation or schema enforcement on custom metadata
- Completely under downstream app control

This separation allows the engine to provide useful standard features without constraining downstream applications' specific requirements.

## Storage vs API Contract

An important distinction exists between the **storage model** (how data is persisted) and the **API contract** (what clients receive). This separation avoids duplication while providing complete information to API consumers.

### Storage Model
**Themes store only:**
- Variable values
- Variable-specific `type` (the actual type of the current value, which may differ from schema allowances)
- Variable-level `custom` metadata (arbitrary downstream data)
- Variable-level `lastModified` timestamps

**Schemas store:**
- Variable descriptions (single source of truth)
- `allowedTypes` array (list of types this variable is permitted to hold)
- Default values
- Validation rules (pattern, enum)
- Schema-level `custom` metadata (structure expected for variable custom metadata)

### API Response Contract
When clients retrieve a variable via JSON API, the engine **merges data from both the schema and storage**:
```
API Response = Storage Variable Data + Schema Metadata (if schema exists)
```

This provides:
- `value`: from storage
- `type`: from storage (the actual type)
- `allowedTypes`: from schema (what types are valid)
- `description`: from schema (single source)
- `custom`: from storage (downstream app data)
- `lastModified`: from storage
- `defaultValue`, `validation`: from schema (if not already set)

### Benefits
1. **No duplication**: Description lives in one place (schema or theme without schema)
2. **Variable flexibility**: Different theme instances can have different types if needed
3. **Type safety**: Downstreams can see both the current type and allowed types for multi-type forms
4. **Clean storage**: Each theme file is lean and focused on values
5. **Schema reference**: Themes can always look up descriptive metadata via their schema

## Data Model

### Theme Object (Storage)
```json
{
  "id": "string (unique identifier)",
  "name": "string (human-readable name)",
  "schemaId": "string (optional reference to schema)",
  "variables": {
    "--variable-name": {
      "value": "string (CSS value)",
      "type": "string (actual type of current value: color, dimension, font, etc.)",
      "custom": {
        "whatever": "custom metadata can be any JSON object, at discretion of downstream app"
      },
      "lastModified": "timestamp (optional)"
    }
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Note:** Theme storage does NOT include `description` - that comes from the schema. If a theme exists without a schema, description can optionally be provided in API requests/responses but is not persisted.

### Schema Object (Storage)
```json
{
  "id": "string (unique identifier)",
  "name": "string (schema name)",
  "version": "string (optional versioning)",
  "variables": {
    "--variable-name": {
      "description": "string (built-in metadata - source of truth)",
      "allowedTypes": [
        "color",
        "dimension",
        "note: list of valid types this variable can hold"
      ],
      "defaultValue": "string (optional)",
      "defaultType": "string (optional)",
      "required": "boolean (optional)",
      "validation": {
        "pattern": "string (regex, optional)",
        "enum": [
          "array of valid values (optional)"
        ]
      },
      "custom": {
        "...": "Schema can define expected custom metadata structure"
      }
    }
  }
}
```

**Note:** Schema stores `description` and `allowedTypes` so they are available to all themes using this schema, avoiding duplication.

## API Endpoints

### Theme CRUD Operations

**GET /themes**
- List all available themes
- Response: Array of theme summaries (may exclude detailed variable metadata to reduce payload)

**GET /themes/:id**
- Retrieve a specific theme with all variables
- Response: Theme object with variables merged with schema metadata (if theme has schemaId)
  - If theme has schema: variables include description, allowedTypes, validation from schema
  - If theme has no schema: variables include only what's stored (value, type, custom)
- This ensures API clients always get complete metadata without needing separate schema fetch

**POST /themes**
- Create a new theme (optionally with initial variables)
- Body: Theme object (without id, which is generated)
  - Can include optional `schemaId` to associate with a schema
  - Variables should not include `description` (will come from schema if associated)
- Response: Created theme with id (and merged schema metadata if applicable)

**PUT /themes/:id**
- Update an entire theme or its schemaId association
- Body: Theme object
  - Variables should not include `description`
  - Can update `schemaId` to change schema association
- Response: Updated theme (with merged schema data if applicable)

**DELETE /themes/:id**
- Delete a theme
- Response: Success confirmation

### CSS Rendering

**GET /themes/:id/stylesheet**
- Retrieve theme as a valid CSS stylesheet
- Response: CSS document with `:root` selector containing all variables
- Content-Type: `text/css`
- Note: Only variable values are included in CSS (no metadata)
- Example output:
```css
:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --font-size-base: 16px;
}
```

### Variable Operations

**GET /themes/:id/variables/:variableName**
- Get a single variable with value and metadata
- Response: Merged JSON combining storage and schema data
- If theme has a schema, description and allowedTypes come from schema
```json
{
  "name": "--primary-color",
  "value": "#3498db",
  "type": "color",
  "allowedTypes": ["color", "string"],
  "description": "Main brand color",
  "custom": {
    "category": "branding",
    "editorControl": "colorPicker"
  },
  "lastModified": "2026-03-07T10:30:00Z",
  "defaultValue": "#000000",
  "validation": {
    "pattern": "^#[0-9a-f]{6}$"
  }
}
```

**PUT /themes/:id/variables/:variableName**
- Set or update a single variable
- Body: Variable object with value and optional type/custom metadata
  - `value` (required): The CSS variable value
  - `type` (optional): The actual type of this value (from allowedTypes in schema, if applicable)
  - `custom` (optional): Variable-specific custom metadata
- Note: Do NOT send `description` in request body (comes from schema)
- Response: Updated variable (merged with schema data if available)

**PATCH /themes/:id/variables**
- Set or update multiple variables at once
- Body: Object mapping variable names to update objects
  - Each contains: `value` (required), `type` (optional), `custom` (optional)
  - Do NOT include `description` (comes from schema)
```json
{
  "--primary-color": {
    "value": "#3498db",
    "type": "color",
    "custom": {
      "category": "branding",
      "editorControl": "colorPicker"
    }
  },
  "--secondary-color": {
    "value": "#2ecc71",
    "type": "color"
  }
}
```
- Response: Updated theme or confirmation

### Schema Operations

**GET /schemas**
- List all available schemas
- Response: Array of schema objects

**GET /schemas/:id**
- Retrieve a specific schema
- Response: Complete schema object

**POST /schemas**
- Create a new schema
- Body: Schema object
- Response: Created schema with id

**PUT /schemas/:id**
- Update a schema
- Body: Schema object
- Response: Updated schema

**DELETE /schemas/:id**
- Delete a schema
- Response: Success confirmation

### Schema-Theme Relationship

**POST /themes/from-schema/:schemaId**
- Create a new theme based on a schema
- Body: Theme name and optional variable overrides
- Response: New theme initialized with schema defaults

**GET /themes/:id/validate**
- Validate theme against its schema (if associated)
- Response: Validation result with any errors/warnings

## Storage Strategy

### Technology Choice: Valkey (Redis-compatible)

Valkey is chosen as the primary data store for its simplicity, efficiency, and perfect alignment with the data model.

### Data Structure

Themes and schemas use different key patterns optimized for their access patterns:

**Themes** (hash-based buckets):
```
theme:{themeId}  (Redis hash)
  --primary-color   → {"value": "#3498db", "type": "color", "custom": {...}, "lastModified": "2026-03-07T10:30:00Z"}
  --secondary-color → {"value": "#2ecc71", "type": "color", ...}
  --font-size-base  → {"value": "16px", "type": "dimension", ...}
```

Operations:
- `HGET theme:{themeId} --variable-name` — fetch single variable
- `HGETALL theme:{themeId}` — fetch entire theme
- `HSET theme:{themeId} --var-name <json>` — set single variable
- `HSET theme:{themeId} key1 <json> key2 <json>` — atomic multi-variable update
- `HDEL theme:{themeId} --variable-name` — delete variable
- `DEL theme:{themeId}` — delete entire theme

**Schemas** (simple key-value):
```
schema:{schemaId} → JSON blob containing full schema definition
```

### Advantages

- **Single round-trip operations**: Most API calls map directly to one Redis command
- **Atomic multi-variable updates**: HSET naturally supports bulk updates
- **Natural bucketing**: Each theme is a hash, making variable operations efficient
- **No schema migration**: Schema validation happens at application layer
- **Operational simplicity**: No relational constraints, referential integrity managed by service layer
- **Easy backup and inspection**: Clear key patterns, human-readable structure

## Implementation Considerations

### Technology Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify (with TypeScript support)
- **Data Store**: Valkey (Redis-compatible KVS)
- **Client**: `ioredis` or `redis` npm package for Valkey connection
- **Validation**: JSON Schema validation (Fastify has built-in support via JSON Schema)
- **Testing**: Jest or Mocha with Chai

### Key Features

1. **Validation**
   - Validate CSS variable names (must start with `--`)
   - Validate variable values against schema validation rules if present (pattern, enum)
   - Validate required variables when schema is associated
   - Validate built-in metadata (`type` must be from schema's `allowedTypes` if specified)
   - Custom metadata is NOT validated - accepts any valid JSON object
   - When a theme has a schema, only allow variable types that are in `allowedTypes`

2. **CSS Generation**
   - Convert JSON variable structure to valid CSS
   - Properly escape values if needed
   - Add source comments (optional)
   - Support CSS-in-JS style comments

3. **Error Handling**
   - Theme not found
   - Variable not found
   - Schema validation failures
   - Invalid CSS variable names or values
   - Duplicate IDs
   - Schema constraint violations

4. **Optional Advanced Features**
   - Theme versioning/history
   - Theme cloning
   - Variable inheritance (theme extends another theme)
   - Export/import themes
   - Bulk operations
   - Search/filter variables by type or custom metadata fields
   - Preview/diff between themes

### Code Organization

```
src/
  server.ts              # Fastify app setup and plugin registration
  plugins/
    themes.ts            # Themes routes plugin
    schemas.ts           # Schemas routes plugin
    variables.ts         # Variable operations plugin
  controllers/
    ThemeController.ts   # Business logic for themes
    SchemaController.ts  # Business logic for schemas
  services/
    ThemeService.ts      # Core theme operations
    SchemaService.ts     # Core schema operations
    CSSGenerator.ts      # CSS stylesheet generation
    ValidationService.ts # Schema validation
  storage/
    ValKeyClient.ts      # Valkey/Redis client initialization and connection handling
    ThemeRepository.ts   # Theme data access layer (theme:{id} hash operations)
    SchemaRepository.ts  # Schema data access layer (schema:{id} key-value operations)
    IRepository.ts       # Repository interface for abstraction
  hooks/
    errorHandler.ts      # Global error handling hook
    validation.ts        # Request validation hooks
  utils/
    cssHelpers.ts        # CSS-related utilities
  types/
    index.ts             # Re-exports all types
    storage.ts           # Storage models (Valkey data structures)
    api.ts               # API models (request/response types, merged data)
    validation.ts        # Validation-related types
```

### Development Phases

**Phase 1: Foundation**
- Set up TypeScript project structure
- Define data models (Theme, Schema, Variable)
- Implement file-based storage layer
- Basic CRUD for themes (no schema support yet)
- CSS stylesheet generation

**Phase 2: Core API**
- Single variable GET/PUT operations
- Multiple variable PATCH operation
- Error handling and validation
- Basic tests

**Phase 3: Schema Support**
- Schema CRUD operations
- Schema validation
- Theme creation from schema
- Schema-theme association

**Phase 4: Enhancement**
- Advanced validation
- Additional endpoints (clone, export, etc.)
- Comprehensive testing
- Documentation

## Testing Strategy

### Unit Tests
- CSS generation from variables
- Variable name validation
- Schema validation logic
- Storage operations
- Built-in metadata validation (type checking)
- Custom metadata preservation (ensure arbitrary JSON is stored/retrieved correctly)

### Integration Tests
- Full API endpoint testing
- Theme CRUD workflow
- Variable manipulation
- CSS rendering
- Schema-based theme creation

### End-to-End Tests
- Create theme → Update variables → Retrieve CSS → Use in HTML
- Create schema → Create theme from schema → Validate

## Usage Example

### Downstream App Integration
```html
<!DOCTYPE html>
<html>
<head>
  <!-- Link the theme stylesheet from the engine -->
  <link rel="stylesheet" href="http://theming-engine.com/themes/acme-corp/stylesheet">
  
  <!-- App's own styles using the variables -->
  <style>
    body {
      background-color: var(--background-color);
      color: var(--text-color);
      font-family: var(--font-family-base);
    }
    .button {
      background-color: var(--primary-color);
      padding: var(--spacing-md);
      border-radius: var(--border-radius);
    }
  </style>
</head>
<body>
  <button class="button">Themed Button</button>
</body>
</html>
```

### Theme Editor Design

The merged API response (scope and storage data) enables downstream applications to build dynamic theme editors. The `allowedTypes` field is particularly important: when a variable supports multiple types, downstream editors can offer type selection to users, enabling flexible theming workflows. The `description` and schema metadata provide form labels and validation hints. Custom metadata allows downstream apps to layer on their own organizational and UI features without engine modifications.

## Security Considerations

1. **Input Validation**: Strictly validate variable names and values
2. **CSS Injection**: Sanitize values to prevent CSS injection attacks
3. **Rate Limiting**: Protect API endpoints from abuse
4. **Authentication**: Consider adding API key or OAuth for write operations
5. **Access Control**: Multi-tenancy support if multiple clients use the system

## Performance Considerations

1. **Caching**: Cache generated CSS stylesheets
2. **Compression**: Gzip CSS responses
3. **CDN**: Consider CDN for stylesheet delivery
4. **Batch Operations**: Support bulk updates efficiently
5. **Lazy Loading**: Only load theme data when needed

## Documentation Requirements

1. **API Documentation**: OpenAPI/Swagger spec
2. **Integration Guide**: How downstream apps consume themes
3. **Schema Guide**: How to define and use schemas
4. **Metadata Guide**: Explanation of built-in vs custom metadata and best practices
5. **Examples**: Sample themes and schemas with various metadata patterns
6. **Migration Guide**: How to update themes when schemas change

---

## Implementation Checklist

- [x] Set up TypeScript configuration
- [x] Define TypeScript interfaces for Theme (storage), Schema (storage), and API response contracts
- [ ] Initialize Valkey client and connection pooling (ValKeyClient.ts)
- [ ] Implement ThemeRepository with hash operations (HGET, HSET, HGETALL, HDEL)
- [ ] Implement SchemaRepository with key-value operations
- [ ] Create ThemeService with CRUD operations (storage-level)
- [ ] Create SchemaService with CRUD operations (storage-level)
- [ ] Add referential integrity checks (prevent schema deletion if themes reference it)
- [ ] Implement API layer that merges schema + theme data for responses
- [ ] Implement CSS generator (uses only variable values from theme storage)
- [ ] Set up Fastify plugins for routes (themes, schemas, variables)
- [ ] Add validation hooks (including allowedTypes validation)
- [ ] Add error handling hooks
- [ ] Implement API response merging logic (combine schema metadata with theme data)
- [ ] Write unit tests for repositories and services (validation, merging logic)
- [ ] Write integration tests for API endpoints (verify merged responses, Valkey operations)
- [ ] Create sample themes and schemas demonstrating type flexibility and metadata patterns
- [ ] Generate API documentation (clarify storage vs API contract, key patterns)
- [ ] Add README with usage examples and setup instructions
