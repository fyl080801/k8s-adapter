import { V1Secret } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Secret document interface extending base K8s document
 */
export interface ISecret extends BaseK8sDocument {
  type: string
  dataCount: number
  immutable?: boolean
}

/**
 * Define Secret-specific fields
 */
const SECRET_FIELDS = {
  type: { type: String, required: true },
  dataCount: { type: Number, default: 0 },
  immutable: { type: Boolean },
}

/**
 * Create Secret schema with type safety
 */
const SecretSchema = createK8sSchema<ISecret>('Secret', SECRET_FIELDS)

/**
 * Transform V1Secret to ISecret document using official K8s types
 */
export const transformSecret = createTransformer<ISecret>(
  (secret: V1Secret) => {
    return {
      type: secret.type || 'Opaque',
      dataCount: secret.data ? Object.keys(secret.data).length : 0,
      immutable: secret.immutable,
    }
  },
)

/**
 * Create or retrieve Secret model
 */
export default createK8sModel<ISecret>('Secret', SecretSchema, transformSecret)
