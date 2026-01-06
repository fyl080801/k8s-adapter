import mongoose, { Schema, Document } from 'mongoose'

export interface ICustomResourceDefinition extends Document {
  name: string
  uid: string
  resourceVersion: string
  labels: Record<string, string>
  annotations: Record<string, string>
  group: string
  version: string
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
  conversion: {
    strategy: string
  } | null
  preservationUnknownFields: boolean
  raw: any
  createdAt: Date
  updatedAt: Date
}

const CustomResourceDefinitionSchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    uid: { type: String, required: true },
    resourceVersion: { type: String, required: true },
    labels: { type: Map, of: String, default: {} },
    annotations: { type: Map, of: String, default: {} },
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
        new Schema(
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
    raw: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  },
)

CustomResourceDefinitionSchema.index({ name: 1 })
CustomResourceDefinitionSchema.index({ group: 1 })

/**
 * Transform Kubernetes CustomResourceDefinition object to MongoDB document
 */
export function transformCustomResourceDefinition(
  crd: any,
): Partial<ICustomResourceDefinition> {
  return {
    name: crd.metadata?.name,
    uid: crd.metadata?.uid,
    resourceVersion: crd.metadata?.resourceVersion,
    labels: crd.metadata?.labels || {},
    annotations: crd.metadata?.annotations || {},
    group: crd.spec?.group,
    version: crd.spec?.version,
    scope: crd.spec?.scope,
    names: {
      plural: crd.spec?.names?.plural,
      singular: crd.spec?.names?.singular,
      kind: crd.spec?.names?.kind,
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
      : null,
    preservationUnknownFields: crd.spec?.preserveUnknownFields,
    raw: crd,
  }
}

export default mongoose.models.CustomResourceDefinition ||
  mongoose.model<ICustomResourceDefinition>(
    'CustomResourceDefinition',
    CustomResourceDefinitionSchema,
  )
