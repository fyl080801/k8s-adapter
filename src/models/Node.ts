import { V1Node, V1NodeAddress, V1NodeCondition } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Node document interface extending base K8s document
 * Note: Node is a cluster-scoped resource, no namespace field
 */
export interface INode extends BaseK8sDocument {
  phase?: string
  addresses: Array<{
    type: string
    address: string
  }>
  nodeInfo: {
    osImage?: string
    kernelVersion?: string
    kubeletVersion?: string
    containerRuntimeVersion?: string
  }
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: Array<{
    type: string
    status: string
    reason?: string
    message?: string
  }>
}

/**
 * Define Node-specific fields
 */
const NODE_FIELDS = {
  phase: { type: String },
  addresses: [
    {
      type: { type: String, required: true },
      address: { type: String, required: true },
    },
  ],
  nodeInfo: {
    osImage: { type: String },
    kernelVersion: { type: String },
    kubeletVersion: { type: String },
    containerRuntimeVersion: { type: String },
  },
  capacity: { type: Map, of: String },
  allocatable: { type: Map, of: String },
  conditions: [
    {
      type: { type: String, required: true },
      status: { type: String, required: true },
      reason: { type: String },
      message: { type: String },
    },
  ],
}

/**
 * Create Node schema with type safety
 * Node doesn't have namespace, so we override name to be unique
 */
const NodeSchema = createK8sSchema<INode>('Node', NODE_FIELDS)

/**
 * Transform V1Node to INode document using official K8s types
 */
export const transformNode = createTransformer<INode>((node: V1Node) => {
  const addresses = (node.status?.addresses || []).map(
    (addr: V1NodeAddress) => ({
      type: addr.type || '',
      address: addr.address || '',
    }),
  )

  const conditions = (node.status?.conditions || []).map(
    (cond: V1NodeCondition) => ({
      type: cond.type || '',
      status: cond.status || '',
      reason: cond.reason,
      message: cond.message,
    }),
  )

  return {
    phase: node.status?.phase,
    addresses,
    nodeInfo: {
      osImage: node.status?.nodeInfo?.osImage,
      kernelVersion: node.status?.nodeInfo?.kernelVersion,
      kubeletVersion: node.status?.nodeInfo?.kubeletVersion,
      containerRuntimeVersion: node.status?.nodeInfo?.containerRuntimeVersion,
    },
    capacity: node.status?.capacity || {},
    allocatable: node.status?.allocatable || {},
    conditions,
  }
})

/**
 * Create or retrieve Node model
 */
export default createK8sModel<INode>('Node', NodeSchema, transformNode)
