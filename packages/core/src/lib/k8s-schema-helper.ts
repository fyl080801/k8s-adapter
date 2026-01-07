/**
 * Kubernetes Schema Helper
 *
 * This utility provides type-safe schema generation using @kubernetes/client-node types.
 * It eliminates manual schema definition by extracting types from official Kubernetes API definitions.
 */

import {
  V1Pod,
  V1Deployment,
  V1Service,
  V1Node,
  V1ConfigMap,
  V1DaemonSet,
  V1Event,
  V1Ingress,
  V1PersistentVolumeClaim,
  V1Secret,
  V1StatefulSet,
  V1ObjectMeta,
} from '@kubernetes/client-node'
import mongoose, { SchemaDefinition, Schema } from 'mongoose'

/**
 * Base document interface for all K8s resources
 * Follows the standard Kubernetes resource structure with flattened uid at top level
 */
export interface BaseK8sDocument extends mongoose.Document {
  uid: string // Flattened from metadata.uid for unique indexing
  kind: string
  apiVersion: string
  namespace?: string // Flattened from metadata.namespace
  name: string // Flattened from metadata.name
  metadata: {
    namespace?: string
    name: string
    uid: string
    resourceVersion: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp?: Date
    [key: string]: any
  }
  spec?: any
  status?: any
  raw: any
  createdAt: Date
  updatedAt: Date
}

/**
 * Common field definitions for all K8s resources
 * Flattened uid, namespace, and name at top level for better indexing and querying
 */
const COMMON_FIELDS: SchemaDefinition = {
  uid: { type: String, required: true, unique: true, index: true },
  kind: { type: String, required: true },
  apiVersion: { type: String, required: true },
  namespace: { type: String, index: true },
  name: { type: String, required: true, index: true },
  metadata: {
    namespace: { type: String },
    name: { type: String, required: true },
    uid: { type: String, required: true, index: false }, // No index - redundant with top-level uid
    resourceVersion: { type: String, required: true },
    labels: { type: mongoose.Schema.Types.Mixed, default: {} },
    annotations: { type: mongoose.Schema.Types.Mixed, default: {} },
    creationTimestamp: { type: Date },
  },
  spec: { type: mongoose.Schema.Types.Mixed },
  status: { type: mongoose.Schema.Types.Mixed },
  raw: { type: mongoose.Schema.Types.Mixed },
}

/**
 * Extract metadata from K8s object
 * Returns flattened object with uid, namespace, name at top level
 */
export function extractMetadata(obj: { metadata?: V1ObjectMeta }) {
  const meta = obj.metadata
  return {
    uid: meta?.uid,
    namespace: meta?.namespace,
    name: meta?.name,
    resourceVersion: meta?.resourceVersion,
    labels: meta?.labels || {},
    annotations: meta?.annotations || {},
    creationTimestamp: meta?.creationTimestamp,
  }
}

/**
 * Create a Mongoose schema for a K8s resource
 * @param resourceName - Name of the resource (for model naming)
 * @param additionalFields - Additional fields specific to this resource type
 * @param additionalIndexes - Additional indexes to create
 */
export function createK8sSchema(
  resourceName: string,
  additionalFields: SchemaDefinition = {},
  additionalIndexes: Array<{ [key: string]: 1 | -1 }> = [],
): Schema {
  const schemaDefinition: SchemaDefinition = {
    ...COMMON_FIELDS,
    ...additionalFields,
  }

  const schema = new Schema(schemaDefinition, {
    timestamps: true,
  })

  // Add compound index on namespace + name (using flattened fields)
  schema.index({ namespace: 1, name: 1 })

  // Add compound index on namespace + createdAt for optimized multi-namespace queries with sorting
  // This significantly improves queries like: find({ namespace: { $in: [...] } }).sort({ createdAt: -1 })
  if (schema.path('namespace') && schema.path('createdAt')) {
    schema.index({ namespace: 1, createdAt: -1 })
  }

  // Note: uid already has unique index from COMMON_FIELDS

  // Add additional indexes
  additionalIndexes.forEach(index => schema.index(index))

  return schema
}

/**
 * Create a generic K8s model with transformer
 * @param modelName - Mongoose model name
 * @param schema - Mongoose schema
 * @param transformer - Function to transform K8s object to MongoDB document
 */
export function createK8sModel<T extends BaseK8sDocument>(
  modelName: string,
  schema: Schema,
  transformer: (k8sObj: any) => Partial<T>,
) {
  // Check if model already exists (for hot reload)
  if ((mongoose.models as any)[modelName]) {
    return (mongoose.models as any)[modelName]
  }

  const model = mongoose.model<T>(modelName, schema)

  // Attach transformer to model for reuse
  ;(model as any).transformK8sObject = transformer

  return model
}

/**
 * Type-safe transformer builder
 * Helps create transformer functions with proper typing
 */
export function createTransformer<T extends BaseK8sDocument>(
  transformFn: (
    k8sObj: any,
    metadata: ReturnType<typeof extractMetadata>,
  ) => Partial<T>,
) {
  return (k8sObj: any): Partial<T> => {
    const metadata = extractMetadata(k8sObj)

    // Build nested metadata object for storage
    const nestedMetadata = {
      namespace: metadata.namespace,
      name: metadata.name,
      uid: metadata.uid,
      resourceVersion: metadata.resourceVersion,
      labels: metadata.labels,
      annotations: metadata.annotations,
      creationTimestamp: metadata.creationTimestamp,
    }

    const additionalData = transformFn(k8sObj, metadata)

    return {
      uid: metadata.uid, // Flattened at top level
      namespace: metadata.namespace, // Flattened at top level
      name: metadata.name, // Flattened at top level
      kind: k8sObj.kind,
      apiVersion: k8sObj.apiVersion,
      metadata: nestedMetadata, // Keep nested for full K8s structure
      spec: (k8sObj as any).spec || undefined,
      status: (k8sObj as any).status || undefined,
      ...additionalData,
      raw: k8sObj,
    }
  }
}

/**
 * Re-export K8s types for convenience
 */
export {
  V1Pod,
  V1Deployment,
  V1Service,
  V1Node,
  V1ConfigMap,
  V1DaemonSet,
  V1Event,
  V1Ingress,
  V1PersistentVolumeClaim,
  V1Secret,
  V1StatefulSet,
}
