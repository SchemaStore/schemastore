# Copilot Instructions for SchemaStore

## Project Overview

SchemaStore is the world's largest collection of independent JSON schemas. This repository contains JSON Schema files that validate popular configuration files and data formats. The schemas are used by IDEs and language servers to provide autocompletion and validation.

## Repository Structure

- `src/schemas/json/` - JSON Schema files
- `src/test/` - Positive test files (JSON, YAML, TOML)
- `src/negative_test/` - Negative test files
- `src/api/json/catalog.json` - Schema catalog mapping schemas to file patterns
- `src/schema-validation.jsonc` - Validation configuration
- `cli.js` - Main CLI tool for schema operations

## Key Guidelines

### Schema Authoring

1. **Use draft-07**: Prefer `draft-07` JSON Schema version for best IDE/language server support
2. **Minimal Changes**: Make surgical, precise changes to existing schemas
3. **No Over-Constraint**:
   - Avoid overly restrictive constraints that may break with new versions
   - Be cautious with `additionalProperties: false` and exhaustive enums
   - Don't add complex regex patterns for cron strings, URLs, or DSLs
4. **Document Everything**:
   - Use `description` fields with format: `<description>\n<url>`
   - Mark undocumented features with `UNDOCUMENTED.` prefix in description
   - Mark deprecated features with `DEPRECATED.` prefix in description
5. **Test Coverage**: Always add positive test files in `src/test/<schemaName>/`
6. **API Compatibility**: Preserve schema names and paths to avoid breaking changes

### Schema Validation

**Always validate changes before committing:**

```bash
# Validate a specific schema
node ./cli.js check --schema-name=<schemaName.json>

# Validate all schemas (slower)
node ./cli.js check
```

### Catalog.json Guidelines

1. **File Matching**: Add appropriate `fileMatch` patterns for auto-detection
2. **Avoid Generic Patterns**: Don't use generic patterns like `config.toml` or `settings.json`
3. **Alphabetical Order**: Register schemas alphabetically in catalog.json
4. **Required Fields**: Include `name`, `description`, `fileMatch`, and `url`

### Code Style

- Use Prettier for formatting: `npm run prettier:fix`
- Follow existing patterns in the codebase
- Don't add comments unless they match existing style

### Creating New Schemas

Use the CLI tool to scaffold new schemas:

```bash
node cli.js new-schema
```

This will:

- Create schema file in `src/schemas/json/<schemaName>.json`
- Create test file in `src/test/<schemaName>/<schemaName>.json`
- Provide catalog.json entry to add manually

### External References

When adding `$ref` to another schema in this repository:

- Both schemas must use the same draft version
- Referenced schema must have proper `$id` field
- Add entry to `src/schema-validation.jsonc` under `externalSchema`

### Common Validation Issues

- **Strict mode errors**: Add schema to `ajvNotStrictMode` array in `schema-validation.jsonc`
- **Unknown format/keyword**: Add schema to `options` object in `schema-validation.jsonc`
- **High schema version**: Add schema to `highSchemaVersion` array

## What NOT to Do

- ❌ Don't remove working code or tests unrelated to your changes
- ❌ Don't add `additionalProperties: false` without careful consideration
- ❌ Don't use exhaustive enums without `"type": "string"` fallback
- ❌ Don't add overly complex regex patterns
- ❌ Don't modify schemas without adding/updating tests
- ❌ Don't commit without running validation
- ❌ Don't use generic fileMatch patterns in catalog.json

## Testing Workflow

1. Make changes to schema file
2. Add/update test files in `src/test/<schemaName>/`
3. Run validation: `node ./cli.js check --schema-name=<schemaName.json>`
4. Run Prettier: `npm run prettier:fix`
5. Commit changes

## Additional Resources

- Full contributing guide: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Schema validation details: See "Schema Validation" section in CONTRIBUTING.md
- Language server compatibility: See "Compatible Language Servers and Tools" section
- Best practices: See "Schema Authoring" section in CONTRIBUTING.md

## Quick Reference

**Add new schema:**

```bash
node cli.js new-schema
```

**Validate schema:**

```bash
node ./cli.js check --schema-name=<schemaName.json>
```

**Format code:**

```bash
npm run prettier:fix
```

**Run type checking:**

```bash
npm run typecheck
```

**Lint CLI:**

```bash
npm run eslint:fix
```
