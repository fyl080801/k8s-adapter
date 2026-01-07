# @k8s-adapter/schema

This package contains all Keystone CMS list definitions for the K8s Adapter project.

## Structure

This package defines the following Keystone lists:

- **User**: User accounts with email and password
- **Post**: Blog posts with rich content (document field)
- **Tag**: Tags for categorizing posts
- **SyncState**: Tracks Kubernetes resource synchronization state

## Usage

The schema is exported and can be imported by the core application:

```typescript
import { lists } from '@k8s-adapter/schema'
```

## Development

To build this package:

```bash
npm run build
```

To watch for changes during development:

```bash
npm run dev
```

## Adding New Lists

1. Add list definitions to `src/schema.ts`
2. Export them as part of the `lists` object
3. Build the package: `npm run build`

The core package will automatically use the updated schema.
