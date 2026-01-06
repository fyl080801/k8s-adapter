# Keystone + Kubernetes Informer

This is a **Keystone 6** headless CMS with integrated **Kubernetes Informer** functionality for real-time K8s resource synchronization.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Visit the Admin UI at [http://localhost:3000](http://localhost:3000)

## 📚 Documentation

All detailed documentation is organized in the **[docs/](docs/)** folder:

### Essential Reading

- **[docs/README.md](docs/README.md)** - Complete documentation index
- **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Project architecture and structure
- **[docs/guides/ADD_NEW_RESOURCES.md](docs/guides/ADD_NEW_RESOURCES.md)** - How to add new K8s resources (中文)

### Key Features

- **[docs/guides/K8S_TYPES_MIGRATION.md](docs/guides/K8S_TYPES_MIGRATION.md)** - Using official K8s TypeScript types
- **[docs/OPTIMIZATION.md](docs/OPTIMIZATION.md)** - Performance optimizations and best practices

### Quick Links

- **[CLAUDE.md](CLAUDE.md)** - Development guide for Claude Code
- **[README.k8s.md](README.k8s.md)** - Kubernetes-specific documentation (中文)

## 🎯 Project Overview

This application serves two purposes:

1. **Keystone CMS**: Provides Admin UI for content management (Users, Posts, Tags)
2. **K8s Resource Sync**: Real-time synchronization of Kubernetes resources to MongoDB with RESTful API access

### Architecture

- **Dual Database Design**:
  - SQLite (Prisma) for Keystone's internal data
  - MongoDB for Kubernetes resource storage

- **Real-time Sync**:
  - Full sync on startup
  - Kubernetes Informer for real-time watch
  - RESTful API at `/api/v1`

- **Type-Safe Models**: Uses official `@kubernetes/client-node` TypeScript types

## 📖 Quick Start Guide

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
MONGODB_URI=mongodb://localhost:27017/k8s-resources
```

### 3. Start Development Server

```bash
npm run dev
```

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
npm run dev          # Start Keystone dev server with hot reload
npm run build        # Build for production
npm start            # Start production server
npm run db:generate  # Regenerate Prisma client
npm run test:api     # Test K8s API endpoints
```

## 🏗️ Project Structure

```
├── docs/                        # Complete documentation
│   ├── README.md               # Documentation index
│   ├── PROJECT_STRUCTURE.md    # Architecture details
│   ├── OPTIMIZATION.md         # Performance best practices
│   ├── guides/                 # Development guides
│   │   ├── ADD_NEW_RESOURCES.md
│   │   └── K8S_TYPES_MIGRATION.md
│   └── archive/                # Historical documentation
├── src/
│   ├── api/                   # RESTful API routes
│   ├── k8s/                   # Kubernetes integration
│   │   ├── types.ts           # Resource configuration registry
│   │   ├── generic-sync.ts
│   │   └── generic-informer.ts
│   ├── lib/                   # Utilities
│   │   └── k8s-schema-helper.ts  # Type-safe schema utilities
│   └── models/                # Mongoose models (11 K8s resources)
├── keystone.ts                # Main entry point
├── auth.ts                    # Authentication configuration
└── schema.prisma              # Keystone database schema
```

See **[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** for complete structure.

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

1. Create Mongoose model (see [docs/guides/ADD_NEW_RESOURCES.md](docs/guides/ADD_NEW_RESOURCES.md))
2. Register in `src/k8s/types.ts`
3. That's it! Automatically gets:
   - Full sync on startup
   - Real-time Informer watch
   - RESTful API endpoints

## 🔍 Key Features

### Type Safety

- Official K8s TypeScript types
- Full IntelliSense support
- Compile-time type checking

### Performance

- Dual-database design (SQLite + MongoDB)
- Optimized sync strategies
- Generic architecture reduces code by ~22%

### Developer Experience

- Auto-generated API routes
- Hot reload in development
- Comprehensive documentation

## 📖 Additional Documentation

See **[docs/README.md](docs/README.md)** for complete documentation index.

## 🙋 Troubleshooting

See [CLAUDE.md](CLAUDE.md) for common issues and solutions.

---

**Last Updated:** 2026-01-06

### Changing the database

We've set you up with an [SQLite database](https://keystonejs.com/docs/apis/config#sqlite) for ease-of-use. If you're wanting to use PostgreSQL, you can!

Just change the `db` property on line 16 of the Keystone file [./keystone.ts](./keystone.ts) to

```typescript
db: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || 'DATABASE_URL_TO_REPLACE',
}
```

And provide your database url from PostgreSQL.

For more on database configuration, check out or [DB API Docs](https://keystonejs.com/docs/apis/config#db)

### Auth

We've put auth into its own file to make this humble starter easier to navigate. To explore it without auth turned on, comment out the `isAccessAllowed` on line 21 of the Keystone file [./keystone.ts](./keystone.ts).

For more on auth, check out our [Authentication API Docs](https://keystonejs.com/docs/apis/auth#authentication-api)

### Adding a frontend

As a Headless CMS, Keystone can be used with any frontend that uses GraphQL. It provides a GraphQL endpoint you can write queries against at `/api/graphql` (by default [http://localhost:3000/api/graphql](http://localhost:3000/api/graphql)). At Thinkmill, we tend to use [Next.js](https://nextjs.org/) and [Apollo GraphQL](https://www.apollographql.com/docs/react/get-started/) as our frontend and way to write queries, but if you have your own favourite, feel free to use it.

A walkthrough on how to do this is forthcoming, but in the meantime our [todo example](https://github.com/keystonejs/keystone-react-todo-demo) shows a Keystone set up with a frontend. For a more full example, you can also look at an example app we built for [Prisma Day 2021](https://github.com/keystonejs/prisma-day-2021-workshop)

### Embedding Keystone in a Next.js frontend

While Keystone works as a standalone app, you can embed your Keystone app into a [Next.js](https://nextjs.org/) app. This is quite a different setup to the starter, and we recommend checking out our walkthrough for that [here](https://keystonejs.com/docs/walkthroughs/embedded-mode-with-sqlite-nextjs#how-to-embed-keystone-sq-lite-in-a-next-js-app).
