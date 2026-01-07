import { V1StatefulSet } from '@kubernetes/client-node'
import mongoose from 'mongoose'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * StatefulSet document interface extending base K8s document
 */
export interface IStatefulSet extends BaseK8sDocument {
  replicas?: number
  readyReplicas: number
  currentReplicas: number
  updatedReplicas: number
  currentRevision?: string
  updateRevision?: string
  selector: Record<string, string>
  serviceName?: string
}

/**
 * Define StatefulSet-specific fields
 */
const STATEFUL_SET_FIELDS = {
  replicas: { type: Number },
  readyReplicas: { type: Number, default: 0 },
  currentReplicas: { type: Number, default: 0 },
  updatedReplicas: { type: Number, default: 0 },
  currentRevision: { type: String },
  updateRevision: { type: String },
  selector: { type: mongoose.Schema.Types.Mixed, default: {} },
  serviceName: { type: String },
}

/**
 * Create StatefulSet schema with type safety
 */
const StatefulSetSchema = createK8sSchema<IStatefulSet>(
  'StatefulSet',
  STATEFUL_SET_FIELDS,
)

/**
 * Transform V1StatefulSet to IStatefulSet document using official K8s types
 */
export const transformStatefulSet = createTransformer<IStatefulSet>(
  (sts: V1StatefulSet) => {
    return {
      replicas: sts.spec?.replicas,
      readyReplicas: sts.status?.readyReplicas || 0,
      currentReplicas: sts.status?.currentReplicas || 0,
      updatedReplicas: sts.status?.updatedReplicas || 0,
      currentRevision: sts.status?.currentRevision,
      updateRevision: sts.status?.updateRevision,
      selector: sts.spec?.selector?.matchLabels || {},
      serviceName: sts.spec?.serviceName,
    }
  },
)

/**
 * Create or retrieve StatefulSet model
 */
export default createK8sModel<IStatefulSet>(
  'StatefulSet',
  StatefulSetSchema,
  transformStatefulSet,
)
