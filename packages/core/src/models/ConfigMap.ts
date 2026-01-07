import { V1ConfigMap } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * ConfigMap document interface extending base K8s document
 */
export interface IConfigMap extends BaseK8sDocument {
  dataCount: number
  binaryDataCount: number
  immutable?: boolean
}

/**
 * Define ConfigMap-specific fields
 */
const CONFIG_MAP_FIELDS = {
  dataCount: { type: Number, default: 0 },
  binaryDataCount: { type: Number, default: 0 },
  immutable: { type: Boolean },
}

/**
 * Create ConfigMap schema with type safety
 */
const ConfigMapSchema = createK8sSchema<IConfigMap>(
  'ConfigMap',
  CONFIG_MAP_FIELDS,
)

/**
 * Transform V1ConfigMap to IConfigMap document using official K8s types
 */
export const transformConfigMap = createTransformer<IConfigMap>(
  (configMap: V1ConfigMap) => {
    return {
      dataCount: configMap.data ? Object.keys(configMap.data).length : 0,
      binaryDataCount: configMap.binaryData
        ? Object.keys(configMap.binaryData).length
        : 0,
      immutable: configMap.immutable,
    }
  },
)

/**
 * Create or retrieve ConfigMap model
 */
export default createK8sModel<IConfigMap>(
  'ConfigMap',
  ConfigMapSchema,
  transformConfigMap,
)
