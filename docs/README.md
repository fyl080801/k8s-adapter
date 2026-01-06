# Documentation

This directory contains all project documentation organized by category.

## 📚 Documentation Index

### Getting Started 🚀

- **[../README.md](../README.md)** - Project overview and quick start guide (English)
- **[../README.k8s.md](../README.k8s.md)** - Kubernetes-specific documentation (中文)
- **[../CLAUDE.md](../CLAUDE.md)** - Development guide for Claude Code AI assistant

### Architecture & Structure 🏗️

- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Complete project structure and file organization
- **[OPTIMIZATION.md](OPTIMIZATION.md)** - Performance optimizations and best practices

### Development Guides 📖

- **[guides/ADD_NEW_RESOURCES.md](guides/ADD_NEW_RESOURCES.md)** - Step-by-step guide for adding new Kubernetes resources (中文)
- **[guides/K8S_TYPES_MIGRATION.md](guides/K8S_TYPES_MIGRATION.md)** - Using @kubernetes/client-node TypeScript types

### Archive 📦

- **[archive/MIGRATION_COMPLETE.md](archive/MIGRATION_COMPLETE.md)** - Type system migration summary
- **[archive/OPTIMIZATION_SUMMARY.md](archive/OPTIMIZATION_SUMMARY.md)** - Performance optimization summary
- **[archive/REFACTORING_SUMMARY.md](archive/REFACTORING_SUMMARY.md)** - Code refactoring summary

## 📖 Recommended Reading Order

### For New Developers 👶

1. Start with [../README.md](../README.md) for project overview
2. Read [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) to understand codebase organization
3. Check [guides/ADD_NEW_RESOURCES.md](guides/ADD_NEW_RESOURCES.md) when adding new K8s resources
4. Reference [../CLAUDE.md](../CLAUDE.md) for AI-assisted development

### For Understanding Type System 🔧

1. Read [guides/K8S_TYPES_MIGRATION.md](guides/K8S_TYPES_MIGRATION.md) for the new type-safe approach
2. Review [archive/MIGRATION_COMPLETE.md](archive/MIGRATION_COMPLETE.md) for migration statistics
3. Study [../src/lib/k8s-schema-helper.ts](../src/lib/k8s-schema-helper.ts) for utility functions

### For Performance Optimization ⚡

1. Start with [OPTIMIZATION.md](OPTIMIZATION.md) for best practices
2. Check [archive/OPTIMIZATION_SUMMARY.md](archive/OPTIMIZATION_SUMMARY.md) for historical context

## 🗂️ Documentation by Category

### Architecture 🏗️

- Project structure and file organization
- Database design (dual-database architecture)
- K8s Informer integration
- Generic architecture patterns

### Development 💻

- Adding new K8s resources
- Using official K8s TypeScript types
- RESTful API generation
- Type-safe schema definitions

### Performance ⚡

- Optimization best practices
- Batch operations
- Memory management
- Performance monitoring

### Historical 📚

- Migration to generic architecture
- Legacy implementation patterns
- Code refactoring history

## 🔍 Quick Reference

### Key Files

- **[../src/lib/k8s-schema-helper.ts](../src/lib/k8s-schema-helper.ts)** - Type-safe schema utilities
- **[../src/k8s/types.ts](../src/k8s/types.ts)** - Resource configuration registry
- **[../src/k8s/generic-sync.ts](../src/k8s/generic-sync.ts)** - Universal sync logic
- **[../src/k8s/generic-informer.ts](../src/k8s/generic-informer.ts)** - Universal watch handlers
- **[../src/api/generic-routes.ts](../src/api/generic-routes.ts)** - Auto-generated API routes

### Common Tasks

**Add a new K8s resource:**

```bash
# Read the guide
cat docs/guides/ADD_NEW_RESOURCES.md

# Or read online
open docs/guides/ADD_NEW_RESOURCES.md
```

**Understand the type system:**

```bash
# Read migration guide
cat docs/guides/K8S_TYPES_MIGRATION.md

# Check helper utilities
cat src/lib/k8s-schema-helper.ts
```

**Check project structure:**

```bash
# Read structure docs
cat docs/PROJECT_STRUCTURE.md

# Or explore
tree -L 3 -I 'node_modules|.git'
```

## 📝 Contributing

When adding new documentation:

1. Use clear, descriptive filenames
2. Update this README.md with the new document
3. Add relevant links in the appropriate section
4. Follow the existing markdown format
5. Include code examples where helpful

## 🔗 External Resources

- **[Keystone 6 Documentation](https://keystonejs.com/)**
- **[Kubernetes JavaScript Client](https://github.com/kubernetes-client/javascript)**
- **[Mongoose TypeScript](https://mongoosejs.com/docs/typescript.html)**
- **[MongoDB Documentation](https://docs.mongodb.com/)**

## 📧 Support

For questions or issues:

1. Check existing documentation first
2. Review [../CLAUDE.md](../CLAUDE.md) for AI assistant usage
3. Consult the official documentation links above

---

**Last Updated:** 2026-01-06
