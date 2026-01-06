import { V1Deployment } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Deployment document interface extending base K8s document
 */
export interface IDeployment extends BaseK8sDocument {
  replicas?: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  unavailableReplicas: number
  selector: Record<string, string>
  strategyType?: string
}

/**
 * Define Deployment-specific fields
 */
const DEPLOYMENT_FIELDS = {
  replicas: { type: Number },
  readyReplicas: { type: Number, default: 0 },
  updatedReplicas: { type: Number, default: 0 },
  availableReplicas: { type: Number, default: 0 },
  unavailableReplicas: { type: Number, default: 0 },
  selector: { type: Map, of: String },
  strategyType: { type: String },
}

/**
 * Create Deployment schema with type safety
 */
const DeploymentSchema = createK8sSchema<IDeployment>(
  'Deployment',
  DEPLOYMENT_FIELDS,
)

/**
 * Transform V1Deployment to IDeployment document using official K8s types
 */
export const transformDeployment = createTransformer<IDeployment>(
  (deployment: V1Deployment) => {
    return {
      replicas: deployment.spec?.replicas,
      readyReplicas: deployment.status?.readyReplicas || 0,
      updatedReplicas: deployment.status?.updatedReplicas || 0,
      availableReplicas: deployment.status?.availableReplicas || 0,
      unavailableReplicas: deployment.status?.unavailableReplicas || 0,
      selector: deployment.spec?.selector?.matchLabels || {},
      strategyType: deployment.spec?.strategy?.type,
    }
  },
)

/**
 * Create or retrieve Deployment model
 */
export default createK8sModel<IDeployment>(
  'Deployment',
  DeploymentSchema,
  transformDeployment,
)
