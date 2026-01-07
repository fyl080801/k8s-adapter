import { V1CustomResourceDefinition } from '@kubernetes/client-node'
import mongoose from 'mongoose'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * CustomResourceDefinition document interface extending base K8s document
 * Note: CRD is a cluster-scoped resource, no namespace field
 */
export interface ICustomResourceDefinition extends BaseK8sDocument {
  group: string
  version?: string
  scope: string
  names: {
    plural: string
    singular: string
    kind: string
    shortNames?: string[]
    listKind?: string
    categories?: string[]
  }
  versions: Array<{
    name: string
    served: boolean
    storage: boolean
    deprecated?: boolean
  }>
  conversion?: {
    strategy: string
  }
  preservationUnknownFields?: boolean
}

/**
 * Define CustomResourceDefinition-specific fields
 */
const CRD_FIELDS = {
  group: { type: String },
  version: { type: String },
  scope: { type: String },
  names: {
    plural: { type: String },
    singular: { type: String },
    kind: { type: String },
    shortNames: { type: [String] },
    listKind: { type: String },
    categories: { type: [String] },
  },
  versions: {
    type: [
      new mongoose.Schema(
        {
          name: { type: String },
          served: { type: Boolean },
          storage: { type: Boolean },
          deprecated: { type: Boolean },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  conversion: {
    strategy: { type: String },
  },
  preservationUnknownFields: { type: Boolean },
}

/**
 * Create CustomResourceDefinition schema with type safety
 * CRD doesn't have namespace, so we index on metadata.name and group
 */
const CustomResourceDefinitionSchema =
  createK8sSchema<ICustomResourceDefinition>(
    'CustomResourceDefinition',
    CRD_FIELDS,
    [{ 'metadata.name': 1 }, { group: 1 }],
  )

/**
 * Transform V1CustomResourceDefinition to ICustomResourceDefinition document
 */
export const transformCustomResourceDefinition =
  createTransformer<ICustomResourceDefinition>(
    (crd: V1CustomResourceDefinition) => {
      return {
        group: crd.spec?.group,
        version: crd.spec?.version,
        scope: crd.spec?.scope || '',
        names: {
          plural: crd.spec?.names?.plural || '',
          singular: crd.spec?.names?.singular || '',
          kind: crd.spec?.names?.kind || '',
          shortNames: crd.spec?.names?.shortNames || [],
          listKind: crd.spec?.names?.listKind,
          categories: crd.spec?.names?.categories || [],
        },
        versions: (crd.spec?.versions || []).map((v: any) => ({
          name: v.name,
          served: v.served,
          storage: v.storage,
          deprecated: v.deprecated,
        })),
        conversion: crd.spec?.conversion
          ? {
              strategy: crd.spec.conversion.strategy,
            }
          : undefined,
        preservationUnknownFields: crd.spec?.preserveUnknownFields,
      }
    },
  )

/**
 * Create or retrieve CustomResourceDefinition model
 */
export default createK8sModel<ICustomResourceDefinition>(
  'CustomResourceDefinition',
  CustomResourceDefinitionSchema,
  transformCustomResourceDefinition,
)
