# @k8s-adapter/core

This is the core application package for the K8s Adapter project. It provides:

- Keystone CMS functionality
- Kubernetes Informer for real-time resource watching
- RESTful API for accessing K8s resources
- MongoDB integration for resource storage

## Development

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## Architecture

This package imports the schema from `@k8s-adapter/schema` and provides:

- K8s Informer integration (real-time watch)
- API routes for K8s resources
- MongoDB connection and models
- Health monitoring and sync status

## Dependencies

- **@k8s-adapter/schema**: Keystone list definitions
- **@keystone-6/core**: Core Keystone functionality
- **@kubernetes/client-node**: Kubernetes API client
- **mongoose**: MongoDB ODM
