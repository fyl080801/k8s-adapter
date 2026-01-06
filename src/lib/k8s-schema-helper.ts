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
import mongoose, { Schema, SchemaDefinition } from 'mongoose'

/**
 * Base document interface for all K8s resources
 */
export interface BaseK8sDocument extends mongoose.Document {
  namespace?: string
  name: string
  uid: string
  resourceVersion: string
  labels: Record<string, string>
  annotations: Record<string, string>
  raw: any
  createdAt: Date
  updatedAt: Date
}

/**
 * Common field definitions for all K8s resources
 */
const COMMON_FIELDS: SchemaDefinition = {
  namespace: { type: String, index: true },
  name: { type: String, required: true, index: true },
  uid: { type: String, required: true, unique: true },
  resourceVersion: { type: String, required: true },
  labels: { type: Map, of: String, default: {} },
  annotations: { type: Map, of: String, default: {} },
  raw: { type: Schema.Types.Mixed },
}

/**
 * Extract metadata from K8s object
 */
export function extractMetadata(obj: { metadata?: V1ObjectMeta }) {
  const meta = obj.metadata
  return {
    namespace: meta?.namespace,
    name: meta?.name,
    uid: meta?.uid,
    resourceVersion: meta?.resourceVersion,
    labels: meta?.labels || {},
    annotations: meta?.annotations || {},
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

  // Add compound index on namespace + name
  schema.index({ namespace: 1, name: 1 })

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
    return {
      ...metadata,
      ...transformFn(k8sObj, metadata),
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
