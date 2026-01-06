/**
 * K8s Resource Type Definitions
 * Centralized configuration for all supported Kubernetes resources
 */

import { Model } from 'mongoose'
import Pod, { transformPod } from '../models/Pod'
import Deployment, { transformDeployment } from '../models/Deployment'
import Service, { transformService } from '../models/Service'
import Node, { transformNode } from '../models/Node'
import StatefulSet, { transformStatefulSet } from '../models/StatefulSet'
import DaemonSet, { transformDaemonSet } from '../models/DaemonSet'
import ConfigMap, { transformConfigMap } from '../models/ConfigMap'
import Secret, { transformSecret } from '../models/Secret'
import Ingress, { transformIngress } from '../models/Ingress'
import PersistentVolumeClaim, {
  transformPersistentVolumeClaim,
} from '../models/PersistentVolumeClaim'
import PersistentVolume, {
  transformPersistentVolume,
} from '../models/PersistentVolume'
import Event, { transformEvent } from '../models/Event'
import CustomResourceDefinition, {
  transformCustomResourceDefinition,
} from '../models/CustomResourceDefinition'

export interface K8sResourceConfig {
  /** Resource name (singular) */
  name: string
  /** Kubernetes API version */
  apiVersion: string
  /** Resource kind */
  kind: string
  /** Plural form for API URLs */
  plural: string
  /** Whether this resource is namespaced */
  namespaced: boolean
  /** Mongoose model for storage */
  model: Model<any>
  /** Transform K8s object to MongoDB document */
  transformer: (k8sObj: any) => any
  /** Extract unique identifier */
  getIdKey: () => string
  /** Icon for logging */
  icon: string
}

/**
 * Resource configurations registry
 * To add a new resource:
 * 1. Create Mongoose model in src/models/ with transformer function
 * 2. Import model and transformer here
 * 3. Add config to RESOURCE_CONFIGS array
 * 4. That's it! Informer, sync, and routes will be auto-generated
 */
export const RESOURCE_CONFIGS: K8sResourceConfig[] = [
  // Core v1 Resources
  {
    name: 'Pod',
    apiVersion: 'v1',
    kind: 'Pod',
    plural: 'pods',
    namespaced: true,
    model: Pod,
    icon: '📦',
    getIdKey: () => 'uid',
    transformer: transformPod,
  },
  {
    name: 'Service',
    apiVersion: 'v1',
    kind: 'Service',
    plural: 'services',
    namespaced: true,
    model: Service,
    icon: '🔗',
    getIdKey: () => 'uid',
    transformer: transformService,
  },
  {
    name: 'Node',
    apiVersion: 'v1',
    kind: 'Node',
    plural: 'nodes',
    namespaced: false,
    model: Node,
    icon: '🖥️',
    getIdKey: () => 'name',
    transformer: transformNode,
  },
  {
    name: 'ConfigMap',
    apiVersion: 'v1',
    kind: 'ConfigMap',
    plural: 'configmaps',
    namespaced: true,
    model: ConfigMap,
    icon: '📋',
    getIdKey: () => 'uid',
    transformer: transformConfigMap,
  },
  {
    name: 'Secret',
    apiVersion: 'v1',
    kind: 'Secret',
    plural: 'secrets',
    namespaced: true,
    model: Secret,
    icon: '🔐',
    getIdKey: () => 'uid',
    transformer: transformSecret,
  },
  {
    name: 'Event',
    apiVersion: 'v1',
    kind: 'Event',
    plural: 'events',
    namespaced: true,
    model: Event,
    icon: '⚡',
    getIdKey: () => 'uid',
    transformer: transformEvent,
  },
  {
    name: 'PersistentVolumeClaim',
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    plural: 'persistentvolumeclaims',
    namespaced: true,
    model: PersistentVolumeClaim,
    icon: '💾',
    getIdKey: () => 'uid',
    transformer: transformPersistentVolumeClaim,
  },

  // Apps/v1 Resources
  {
    name: 'Deployment',
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    plural: 'deployments',
    namespaced: true,
    model: Deployment,
    icon: '🎯',
    getIdKey: () => 'uid',
    transformer: transformDeployment,
  },
  {
    name: 'StatefulSet',
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    plural: 'statefulsets',
    namespaced: true,
    model: StatefulSet,
    icon: '🔢',
    getIdKey: () => 'uid',
    transformer: transformStatefulSet,
  },
  {
    name: 'DaemonSet',
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
    plural: 'daemonsets',
    namespaced: true,
    model: DaemonSet,
    icon: '👻',
    getIdKey: () => 'uid',
    transformer: transformDaemonSet,
  },

  // Networking.k8s.io/v1 Resources
  {
    name: 'Ingress',
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    plural: 'ingresses',
    namespaced: true,
    model: Ingress,
    icon: '🌐',
    getIdKey: () => 'uid',
    transformer: transformIngress,
  },

  // APIextensions.k8s.io/v1 Resources
  {
    name: 'CustomResourceDefinition',
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    plural: 'customresourcedefinitions',
    namespaced: false,
    model: CustomResourceDefinition,
    icon: '🔧',
    getIdKey: () => 'name',
    transformer: transformCustomResourceDefinition,
  },

  // Additional Core v1 Resources
  {
    name: 'PersistentVolume',
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    plural: 'persistentvolumes',
    namespaced: false,
    model: PersistentVolume,
    icon: '💿',
    getIdKey: () => 'name',
    transformer: transformPersistentVolume,
  },
]

/**
 * Get resource config by plural name
 */
export function getResourceConfig(
  plural: string,
): K8sResourceConfig | undefined {
  return RESOURCE_CONFIGS.find(config => config.plural === plural)
}

/**
 * Get all resource configs
 */
export function getAllResourceConfigs(): K8sResourceConfig[] {
  return RESOURCE_CONFIGS
}
