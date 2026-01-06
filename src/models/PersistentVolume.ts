import mongoose, { Schema, Document } from 'mongoose'

export interface IPersistentVolume extends Document {
  name: string
  uid: string
  resourceVersion: string
  labels: Record<string, string>
  annotations: Record<string, string>
  phase: string
  capacity: Record<string, string>
  accessModes: string[]
  persistentVolumeReclaimPolicy: string
  storageClass: string
  claimRef: {
    name: string
    namespace: string
  } | null
  reason: string
  raw: any
  createdAt: Date
  updatedAt: Date
}

const PersistentVolumeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    uid: { type: String, required: true },
    resourceVersion: { type: String, required: true },
    labels: { type: Map, of: String, default: {} },
    annotations: { type: Map, of: String, default: {} },
    phase: { type: String },
    capacity: { type: Map, of: String, default: {} },
    accessModes: { type: [String], default: [] },
    persistentVolumeReclaimPolicy: { type: String },
    storageClass: { type: String },
    claimRef: {
      name: String,
      namespace: String,
    },
    reason: { type: String },
    raw: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
)

PersistentVolumeSchema.index({ name: 1 })

/**
 * Transform Kubernetes PersistentVolume object to MongoDB document
 */
export function transformPersistentVolume(pv: any): Partial<IPersistentVolume> {
  return {
    name: pv.metadata?.name,
    uid: pv.metadata?.uid,
    resourceVersion: pv.metadata?.resourceVersion,
    labels: pv.metadata?.labels || {},
    annotations: pv.metadata?.annotations || {},
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
      : null,
    reason: pv.status?.reason,
    raw: pv,
  }
}

export default mongoose.models.PersistentVolume ||
  mongoose.model<IPersistentVolume>('PersistentVolume', PersistentVolumeSchema)
