import { V1DaemonSet } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * DaemonSet document interface extending base K8s document
 */
export interface IDaemonSet extends BaseK8sDocument {
  currentNumberScheduled: number
  desiredNumberScheduled: number
  numberAvailable: number
  numberMisscheduled: number
  numberReady: number
  updatedNumberScheduled: number
  selector: Record<string, string>
}

/**
 * Define DaemonSet-specific fields
 */
const DAEMON_SET_FIELDS = {
  currentNumberScheduled: { type: Number, default: 0 },
  desiredNumberScheduled: { type: Number, default: 0 },
  numberAvailable: { type: Number, default: 0 },
  numberMisscheduled: { type: Number, default: 0 },
  numberReady: { type: Number, default: 0 },
  updatedNumberScheduled: { type: Number, default: 0 },
  selector: { type: Map, of: String, default: {} },
}

/**
 * Create DaemonSet schema with type safety
 */
const DaemonSetSchema = createK8sSchema<IDaemonSet>(
  'DaemonSet',
  DAEMON_SET_FIELDS,
)

/**
 * Transform V1DaemonSet to IDaemonSet document using official K8s types
 */
export const transformDaemonSet = createTransformer<IDaemonSet>(
  (daemonSet: V1DaemonSet) => {
    return {
      currentNumberScheduled: daemonSet.status?.currentNumberScheduled || 0,
      desiredNumberScheduled: daemonSet.status?.desiredNumberScheduled || 0,
      numberAvailable: daemonSet.status?.numberAvailable || 0,
      numberMisscheduled: daemonSet.status?.numberMisscheduled || 0,
      numberReady: daemonSet.status?.numberReady || 0,
      updatedNumberScheduled: daemonSet.status?.updatedNumberScheduled || 0,
      selector: daemonSet.spec?.selector?.matchLabels || {},
    }
  },
)

/**
 * Create or retrieve DaemonSet model
 */
export default createK8sModel<IDaemonSet>(
  'DaemonSet',
  DaemonSetSchema,
  transformDaemonSet,
)
