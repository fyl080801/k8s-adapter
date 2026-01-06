import {
  V1Ingress,
  V1IngressRule,
  V1HTTPIngressPath,
  V1IngressTLS,
} from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Ingress document interface extending base K8s document
 */
export interface IIngress extends BaseK8sDocument {
  ingressClassName?: string
  rules: Array<{
    host?: string
    paths: Array<{
      path?: string
      pathType?: string
      backend: {
        service: {
          name?: string
          port: {
            number?: number
          }
        }
      }
    }>
  }>
  tls: Array<{
    hosts: string[]
    secretName?: string
  }>
}

/**
 * Define Ingress-specific fields
 */
const INGRESS_FIELDS = {
  ingressClassName: { type: String },
  rules: [
    {
      host: { type: String },
      paths: [
        {
          path: { type: String },
          pathType: { type: String },
          backend: {
            service: {
              name: { type: String },
              port: {
                number: { type: Number },
              },
            },
          },
        },
      ],
    },
  ],
  tls: [
    {
      hosts: { type: [String] },
      secretName: { type: String },
    },
  ],
}

/**
 * Create Ingress schema with type safety
 */
const IngressSchema = createK8sSchema<IIngress>('Ingress', INGRESS_FIELDS)

/**
 * Transform V1Ingress to IIngress document using official K8s types
 */
export const transformIngress = createTransformer<IIngress>(
  (ingress: V1Ingress) => {
    const rules = (ingress.spec?.rules || []).map((rule: V1IngressRule) => ({
      host: rule.host,
      paths: (rule.http?.paths || []).map((path: V1HTTPIngressPath) => ({
        path: path.path,
        pathType: path.pathType,
        backend: {
          service: {
            name: path.backend?.service?.name,
            port: {
              number: path.backend?.service?.port?.number,
            },
          },
        },
      })),
    }))

    const tls = (ingress.spec?.tls || []).map((tlsConfig: V1IngressTLS) => ({
      hosts: tlsConfig.hosts || [],
      secretName: tlsConfig.secretName,
    }))

    return {
      ingressClassName: ingress.spec?.ingressClassName,
      rules,
      tls,
    }
  },
)

/**
 * Create or retrieve Ingress model
 */
export default createK8sModel<IIngress>(
  'Ingress',
  IngressSchema,
  transformIngress,
)
