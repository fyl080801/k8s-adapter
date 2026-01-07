import { V1ConfigMap } from '@kubernetes/client-node'
import mongoose from 'mongoose'
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
  data: Record<string, string>
  binaryData: Record<string, string>
  immutable?: boolean
}

/**
 * Define ConfigMap-specific fields
 */
const CONFIG_MAP_FIELDS = {
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  binaryData: { type: mongoose.Schema.Types.Mixed, default: {} },
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
      data: configMap.data || {},
      binaryData: configMap.binaryData || {},
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
