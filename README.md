# K8s Adapter - Monorepo

This is a **Keystone 6** headless CMS with integrated **Kubernetes Informer** functionality, organized as a monorepo for better separation of concerns.

## 🏗️ Monorepo Structure

This project is organized as an npm workspace with two packages:

```
packages/
├── schema/          # Keystone list definitions (data models)
│   └── src/
│       ├── schema.ts    # User, Post, Tag, SyncState lists
│       └── index.ts     # Export point
└── core/            # Main application (K8s integration + API)
    ├── src/
    │   ├── api/         # RESTful API routes
    │   ├── k8s/         # Kubernetes Informer integration
    │   ├── lib/         # Utilities (MongoDB, etc.)
    │   ├── middleware/  # Express middleware
    │   └── models/      # Mongoose models for K8s resources
    ├── keystone.ts      # Entry point
    └── auth.ts          # Authentication config
```

### Package Overview

**@k8s-adapter/schema**

- Contains all Keystone CMS list definitions
- Defines data structure (User, Post, Tag, SyncState)
- Pure TypeScript with no runtime dependencies on core logic
- Can be imported independently for schema validation

**@k8s-adapter/core**

- Main application with Keystone server
- Kubernetes Informer integration
- RESTful API for K8s resources
- MongoDB models and connections
- Imports schema from `@k8s-adapter/schema`

## 🚀 Quick Start

```bash
# Install dependencies (installs for all packages)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit the Admin UI at [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

All detailed documentation is organized in the **[docs/](docs/)** folder:

### Essential Reading

- **[CLAUDE.md](CLAUDE.md)** - Development guide for Claude Code (AI-assisted development)
- **[docs/STRUCTURE.md](docs/STRUCTURE.md)** - Project architecture and structure
- **[docs/QUICKSTART.md](docs/QUICKSTART.md)** - Quick start guide
- **[docs/MIGRATION.md](docs/MIGRATION.md)** - Migration guide

### Package Documentation

- **[docs/PACKAGE-CORE.md](docs/PACKAGE-CORE.md)** - Core package documentation
- **[docs/PACKAGE-SCHEMA.md](docs/PACKAGE-SCHEMA.md)** - Schema package documentation

### Logging Documentation

- **[docs/LOGGING.md](docs/LOGGING.md)** - Logging system overview
- **[docs/LOGGER_QUICKREF.md](docs/LOGGER_QUICKREF.md)** - Logger quick reference
- **[docs/LOGGER_IMPLEMENTATION.md](docs/LOGGER_IMPLEMENTATION.md)** - Logger implementation details
- **[docs/WINSTON_LOGGER_SUMMARY.md](docs/WINSTON_LOGGER_SUMMARY.md)** - Winston logger summary

## 🎯 Project Overview

This application serves two purposes:

1. **Keystone CMS**: Provides Admin UI for content management (Users, Posts, Tags)
2. **K8s Resource Sync**: Real-time synchronization of Kubernetes resources to MongoDB with RESTful API access

### Architecture

- **Dual Database Design**:
  - SQLite (Prisma) for Keystone's internal data
  - MongoDB for Kubernetes resource storage

- **Monorepo Benefits**:
  - Clear separation between schema definitions and business logic
  - Schema can be versioned and shared independently
  - Easier to test schema changes in isolation
  - Better code organization and maintainability

- **Real-time Sync**:
  - Full sync on startup
  - Kubernetes Informer for real-time watch
  - RESTful API at `/api/v1`

## 📖 Quick Start Guide

### 1. Install Dependencies

```bash
npm install
```

This installs dependencies for all packages in the monorepo.

### 2. Configure Environment

Create `.env` file in the root:

```bash
MONGODB_URI=mongodb://localhost:27017/k8s-resources

# Optional: Logging configuration
LOG_LEVEL=info                    # debug, info, warn, error
ENABLE_FILE_LOGGING=false         # Enable file logging with daily rotation
LOG_DIR=./logs                    # Directory for log files
ENABLE_LOG_COLORS=true            # Enable colored console output
```

### 3. Start Development Server

```bash
npm run dev
```

This starts the core package's development server.

### 4. Test API Endpoints

```bash
# Health check
curl http://localhost:3000/api/v1/health

# List all pods
curl http://localhost:3000/api/v1/pods

# Get deployments by namespace
curl http://localhost:3000/api/v1/deployments?namespace=default
```

## 🛠️ Development Commands

```bash
npm run dev          # Start Keystone dev server (core package)
npm run build        # Build for production (core package)
npm start            # Start production server (core package)
npm run db:generate  # Regenerate Prisma client
npm run test:api     # Test K8s API endpoints
npm run clean        # Clean all packages
```

### Package-Specific Commands

```bash
# Schema package
npm run dev --workspace=packages/schema  # Watch schema changes
npm run build --workspace=packages/schema  # Build schema

# Core package
npm run dev --workspace=packages/core    # Start dev server
npm run build --workspace=packages/core  # Build core
```

## 🏗️ Working with the Monorepo

### Adding New Fields to Schema

1. Edit `packages/schema/src/schema.ts`
2. The schema package will be automatically imported by the core package
3. No need to restart - Keystone will hot-reload the schema

### Modifying Core Logic

1. Edit files in `packages/core/src/`
2. Changes will hot-reload in development mode
3. Schema is imported from `@k8s-adapter/schema`

### Building Packages

The schema package must be built before it can be imported:

```bash
# Build schema package
npm run build --workspace=packages/schema

# Core package uses workspace references
# No build step needed if developing
```

## 🎯 Supported K8s Resources

All resources use official TypeScript types from `@kubernetes/client-node`:

- ✅ Pod
- ✅ Deployment
- ✅ Service
- ✅ Node
- ✅ ConfigMap
- ✅ Secret
- ✅ DaemonSet
- ✅ StatefulSet
- ✅ Ingress
- ✅ PersistentVolumeClaim
- ✅ Event

## 🔌 Adding New Resources

The project uses a **generic, configuration-driven architecture**:

1. Create Mongoose model in `packages/core/src/models/`
2. Register in `packages/core/src/k8s/types.ts`
3. That's it! Automatically gets:
   - Full sync on startup
   - Real-time Informer watch
   - RESTful API endpoints

See [docs/guides/ADD_NEW_RESOURCES.md](docs/guides/ADD_NEW_RESOURCES.md) for detailed instructions.

## 📖 Additional Documentation

See **[docs/README.md](docs/README.md)** for complete documentation index.

## 🙋 Troubleshooting

See [CLAUDE.md](CLAUDE.md) for common issues and solutions.

### Common Monorepo Issues

**Schema changes not reflected:**

- Ensure the schema package is built: `npm run build --workspace=packages/schema`
- Restart the dev server

**Import errors:**

- Run `npm install` to ensure workspace links are set up correctly
- Check that `packages/schema/package.json` has the correct name

---

**Last Updated:** 2026-01-07
