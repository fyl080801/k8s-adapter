# Migration Guide: Monorepo Restructuring

This document explains how the project was restructured from a single-package to a monorepo architecture.

## What Changed

### Before (Single Package)

```
k8s-adapter/
├── src/              # All source code
├── schema.ts         # Keystone schema
├── keystone.ts       # Entry point
└── package.json
```

### After (Monorepo)

```
k8s-adapter/
├── packages/
│   ├── schema/       # Keystone list definitions
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── core/         # Main application
│       ├── src/      # api/, k8s/, lib/, middleware/, models/
│       ├── keystone.ts
│       ├── auth.ts
│       ├── schema.prisma
│       └── package.json
└── package.json      # Root workspace config
```

## Why This Change?

### Benefits

1. **Separation of Concerns**
   - Schema definitions are isolated from business logic
   - Easier to understand data structure independently

2. **Reusability**
   - Schema package can be imported by other projects
   - Can be versioned and published independently

3. **Better Testing**
   - Schema can be tested in isolation
   - Core logic tests can mock schema package

4. **Maintainability**
   - Clear boundaries between packages
   - Easier to onboard new developers

5. **Scalability**
   - Easy to add more packages (e.g., `admin-ui`, `cli`)
   - Better dependency management

## Migration Steps for Developers

### 1. Update Your Local Environment

```bash
# Remove old node_modules
rm -rf node_modules package-lock.json

# Install with workspace support
npm install
```

### 2. Update Import Paths

If you have any custom code that imports schema:

**Before:**

```typescript
import { lists } from './schema'
```

**After:**

```typescript
import { lists } from '@k8s-adapter/schema'
```

### 3. Update Environment Variables

No changes needed - `.env` file remains in the root directory.

### 4. Update Development Workflow

**Starting the dev server:**

```bash
# Old way (still works):
npm run dev

# New way (explicit package):
npm run dev --workspace=packages/core
```

**Building:**

```bash
# Build schema package (new requirement)
npm run build --workspace=packages/schema

# Build core package
npm run build --workspace=packages/core
```

## Breaking Changes

### None!

All scripts in the root `package.json` delegate to the appropriate package, so your workflow remains unchanged:

- `npm run dev` - Still starts the development server
- `npm run build` - Still builds for production
- `npm start` - Still starts production server
- `npm run test:api` - Still runs API tests

## File Locations

### Schema Definitions

- **Old:** `schema.ts` (root)
- **New:** `packages/schema/src/schema.ts`

### Core Logic

- **Old:** `src/api/`, `src/k8s/`, etc.
- **New:** `packages/core/src/api/`, `packages/core/src/k8s/`, etc.

### Configuration Files

- **Unchanged:** `.env`, `auth.ts`, `schema.prisma` (now in `packages/core/`)
- **Moved:** `keystone.ts` → `packages/core/keystone.ts`

## Adding New Features

### Adding New Schema Fields

Edit `packages/schema/src/schema.ts`:

```typescript
export const lists = {
  User: list({
    fields: {
      // Add new fields here
      newField: text({ validation: { isRequired: true } }),
    },
  }),
}
```

### Adding New API Routes

Edit files in `packages/core/src/api/` as before.

### Adding New K8s Resources

1. Create model in `packages/core/src/models/`
2. Register in `packages/core/src/k8s/types.ts`

Everything else is automatic!

## Troubleshooting

### "Cannot find module '@k8s-adapter/schema'"

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "Schema changes not reflected"

```bash
# Build schema package
npm run build --workspace=packages/core

# Restart dev server
npm run dev
```

### Type Errors in VS Code

1. Reload TypeScript: `Cmd+Shift+P` → "TypeScript: Restart TS Server"
2. Ensure you've run `npm install`
3. Check that `packages/schema` has been built at least once

## CI/CD Updates

If you have CI/CD pipelines, update them:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: npm install

- name: Build schema
  run: npm run build --workspace=packages/schema

- name: Build core
  run: npm run build --workspace=packages/core

- name: Run tests
  run: npm test
```

## Summary

The monorepo restructuring improves code organization without breaking existing functionality. All your scripts and workflows continue to work as before, with the added benefit of better separation between schema definitions and business logic.

---

**Questions?** Check the main [README.md](../README.md) or [CLAUDE.md](../CLAUDE.md) for more information.
