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
  data: Record<string, string>
  immutable?: boolean
}

/**
 * Define Secret-specific fields
 */
const SECRET_FIELDS = {
  type: { type: String, required: true },
  data: { type: Map, of: String, default: {} },
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
      data: secret.data || {},
      immutable: secret.immutable,
    }
  },
)

/**
 * Create or retrieve Secret model
 */
export default createK8sModel<ISecret>('Secret', SecretSchema, transformSecret)
