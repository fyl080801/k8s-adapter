import { V1PersistentVolumeClaim } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * PersistentVolumeClaim document interface extending base K8s document
 */
export interface IPersistentVolumeClaim extends BaseK8sDocument {
  phase?: string
  accessModes: string[]
  capacity: Record<string, string>
  storageClass?: string
  volumeName?: string
}

/**
 * Define PersistentVolumeClaim-specific fields
 */
const PVC_FIELDS = {
  phase: { type: String },
  accessModes: [{ type: String }],
  capacity: { type: Map, of: String, default: {} },
  storageClass: { type: String },
  volumeName: { type: String },
}

/**
 * Create PersistentVolumeClaim schema with type safety
 */
const PersistentVolumeClaimSchema = createK8sSchema<IPersistentVolumeClaim>(
  'PersistentVolumeClaim',
  PVC_FIELDS,
)

/**
 * Transform V1PersistentVolumeClaim to IPersistentVolumeClaim document using official K8s types
 */
export const transformPersistentVolumeClaim =
  createTransformer<IPersistentVolumeClaim>((pvc: V1PersistentVolumeClaim) => {
    return {
      phase: pvc.status?.phase,
      accessModes: pvc.spec?.accessModes || [],
      capacity: pvc.status?.capacity || {},
      storageClass: pvc.spec?.storageClassName,
      volumeName: pvc.spec?.volumeName,
    }
  })

/**
 * Create or retrieve PersistentVolumeClaim model
 */
export default createK8sModel<IPersistentVolumeClaim>(
  'PersistentVolumeClaim',
  PersistentVolumeClaimSchema,
  transformPersistentVolumeClaim,
)
