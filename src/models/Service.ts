import { V1Service, V1ServicePort } from '@kubernetes/client-node'
import mongoose from 'mongoose'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Service document interface extending base K8s document
 */
export interface IService extends BaseK8sDocument {
  clusterIP?: string
  externalIPs: string[]
  type?: string
  ports: Array<{
    name?: string
    port: number
    targetPort?: number | string
    protocol?: string
    nodePort?: number
  }>
  selector: Record<string, string>
}

/**
 * Define Service-specific fields
 */
const SERVICE_FIELDS = {
  clusterIP: { type: String },
  externalIPs: { type: [String] },
  type: { type: String },
  ports: [
    {
      name: { type: String },
      port: { type: Number, required: true },
      targetPort: { type: mongoose.Schema.Types.Mixed },
      protocol: { type: String },
      nodePort: { type: Number },
    },
  ],
  selector: { type: mongoose.Schema.Types.Mixed, default: {} },
}

/**
 * Create Service schema with type safety
 */
const ServiceSchema = createK8sSchema<IService>('Service', SERVICE_FIELDS)

/**
 * Transform V1Service to IService document using official K8s types
 */
export const transformService = createTransformer<IService>(
  (service: V1Service) => {
    const ports = (service.spec?.ports || []).map((port: V1ServicePort) => ({
      name: port.name,
      port: port.port,
      targetPort: port.targetPort,
      protocol: port.protocol,
      nodePort: port.nodePort,
    }))

    return {
      clusterIP: service.spec?.clusterIP,
      externalIPs: service.spec?.externalIPs || [],
      type: service.spec?.type,
      ports,
      selector: service.spec?.selector || {},
    }
  },
)

/**
 * Create or retrieve Service model
 */
export default createK8sModel<IService>(
  'Service',
  ServiceSchema,
  transformService,
)
