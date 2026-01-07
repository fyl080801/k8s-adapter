import { V1PersistentVolume } from '@kubernetes/client-node'
import mongoose from 'mongoose'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * PersistentVolume document interface extending base K8s document
 * Note: PersistentVolume is a cluster-scoped resource, no namespace field
 */
export interface IPersistentVolume extends BaseK8sDocument {
  phase?: string
  capacity: Record<string, string>
  accessModes: string[]
  persistentVolumeReclaimPolicy?: string
  storageClass?: string
  claimRef?: {
    name: string
    namespace: string
  }
  reason?: string
}

/**
 * Define PersistentVolume-specific fields
 */
const PV_FIELDS = {
  phase: { type: String },
  capacity: { type: mongoose.Schema.Types.Mixed, default: {} },
  accessModes: { type: [String], default: [] },
  persistentVolumeReclaimPolicy: { type: String },
  storageClass: { type: String },
  claimRef: {
    name: { type: String },
    namespace: { type: String },
  },
  reason: { type: String },
}

/**
 * Create PersistentVolume schema with type safety
 * PersistentVolume doesn't have namespace, so we override name to be unique
 */
const PersistentVolumeSchema = createK8sSchema<IPersistentVolume>(
  'PersistentVolume',
  PV_FIELDS,
  [{ 'metadata.name': 1 }],
)

/**
 * Transform V1PersistentVolume to IPersistentVolume document using official K8s types
 */
export const transformPersistentVolume = createTransformer<IPersistentVolume>(
  (pv: V1PersistentVolume) => {
    return {
      phase: pv.status?.phase,
      capacity: pv.spec?.capacity || {},
      accessModes: pv.spec?.accessModes || [],
      persistentVolumeReclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
      storageClass: pv.spec?.storageClassName,
      claimRef: pv.spec?.claimRef
        ? {
            name: pv.spec.claimRef.name,
            namespace: pv.spec.claimRef.namespace,
          }
        : undefined,
      reason: pv.status?.reason,
    }
  },
)

/**
 * Create or retrieve PersistentVolume model
 */
export default createK8sModel<IPersistentVolume>(
  'PersistentVolume',
  PersistentVolumeSchema,
  transformPersistentVolume,
)
