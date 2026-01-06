import { V1Pod, V1Container, V1ContainerStatus } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Pod document interface extending base K8s document
 */
export interface IPod extends BaseK8sDocument {
  phase?: string
  podIP?: string
  nodeName?: string
  startTime?: Date
  containers: Array<{
    name: string
    image: string
    ready: boolean
    restartCount: number
  }>
}

/**
 * Define Pod-specific fields (in addition to common fields)
 */
const POD_FIELDS = {
  phase: { type: String },
  podIP: { type: String },
  nodeName: { type: String, index: true },
  startTime: { type: Date },
  containers: [
    {
      name: { type: String, required: true },
      image: { type: String, required: true },
      ready: { type: Boolean, default: false },
      restartCount: { type: Number, default: 0 },
    },
  ],
}

/**
 * Create Pod schema with type safety
 */
const PodSchema = createK8sSchema<IPod>('Pod', POD_FIELDS, [{ nodeName: 1 }])

/**
 * Transform V1Pod to IPod document using official K8s types
 */
export const transformPod = createTransformer<IPod>((pod: V1Pod, _meta) => {
  // Extract container information with type safety
  const containers = (pod.spec?.containers || []).map(
    (container: V1Container) => {
      const status = (pod.status?.containerStatuses || []).find(
        (s: V1ContainerStatus) => s.name === container.name,
      )

      return {
        name: container.name,
        image: container.image,
        ready: status?.ready || false,
        restartCount: status?.restartCount || 0,
      }
    },
  )

  return {
    phase: pod.status?.phase,
    podIP: pod.status?.podIP,
    nodeName: pod.spec?.nodeName,
    startTime: pod.status?.startTime
      ? new Date(pod.status.startTime)
      : undefined,
    containers,
  }
})

/**
 * Create or retrieve Pod model
 */
export default createK8sModel<IPod>('Pod', PodSchema, transformPod)
