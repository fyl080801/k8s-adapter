/**
 * Kubernetes Client Utility
 * Provides unified access to Kubernetes API using @kubernetes/client-node
 * This module is used for direct K8s operations (non-database queries)
 */

import * as k8s from '@kubernetes/client-node'

/**
 * Kubernetes client singleton
 */
let k8sConfig: k8s.KubeConfig | null = null
let k8sApis: {
  coreV1Api: k8s.CoreV1Api
  appsV1Api: k8s.AppsV1Api
  batchV1Api: k8s.BatchV1Api
  networkingV1Api: k8s.NetworkingV1Api
  apiextensionsV1Api: k8s.ApiextensionsV1Api
} | null = null

/**
 * Initialize Kubernetes client (lazy initialization)
 */
function getK8sConfig() {
  if (!k8sConfig) {
    k8sConfig = new k8s.KubeConfig()
    k8sConfig.loadFromDefault()
  }
  return k8sConfig
}

/**
 * Get Kubernetes API clients
 */
function getK8sApis() {
  if (!k8sApis) {
    const config = getK8sConfig()
    k8sApis = {
      coreV1Api: config.makeApiClient(k8s.CoreV1Api),
      appsV1Api: config.makeApiClient(k8s.AppsV1Api),
      batchV1Api: config.makeApiClient(k8s.BatchV1Api),
      networkingV1Api: config.makeApiClient(k8s.NetworkingV1Api),
      apiextensionsV1Api: config.makeApiClient(k8s.ApiextensionsV1Api),
    }
  }
  return k8sApis
}

/**
 * Get API client by resource kind
 */
export function getApiClient(kind: string) {
  const apis = getK8sApis()

  const apiMap: Record<string, any> = {
    // Core v1 resources
    Pod: apis.coreV1Api,
    Service: apis.coreV1Api,
    Node: apis.coreV1Api,
    ConfigMap: apis.coreV1Api,
    Secret: apis.coreV1Api,
    Event: apis.coreV1Api,
    PersistentVolume: apis.coreV1Api,
    PersistentVolumeClaim: apis.coreV1Api,

    // Apps/v1 resources
    Deployment: apis.appsV1Api,
    StatefulSet: apis.appsV1Api,
    DaemonSet: apis.appsV1Api,

    // Networking.k8s.io/v1 resources
    Ingress: apis.networkingV1Api,

    // APIextensions.k8s.io/v1 resources
    CustomResourceDefinition: apis.apiextensionsV1Api,
  }

  const api = apiMap[kind]
  if (!api) {
    throw new Error(`No API client found for resource kind: ${kind}`)
  }

  return api
}

/**
 * Get raw Kubernetes object by kind, namespace (optional), and name
 */
export async function getK8sObject(
  kind: string,
  name: string,
  namespace?: string,
): Promise<any> {
  const api = getApiClient(kind)

  // Convert kind to lowercase (e.g., 'Pod' -> 'pod')
  const resourceKind = kind.toLowerCase()

  try {
    // Core v1 resources with namespace
    if (namespace && typeof (api as any).readNamespaced === 'function') {
      const method = `readNamespaced${kind}`
      if (typeof (api as any)[method] === 'function') {
        return await (api as any)[method](name, namespace)
      }
      // Fallback to generic readNamespaced
      return await (api as any).readNamespaced(resourceKind, name, namespace)
    }

    // Cluster-scoped resources or resources without readNamespaced
    const method = `read${kind}`
    if (typeof (api as any)[method] === 'function') {
      return await (api as any)[method](name)
    }

    throw new Error(`No read method found for ${kind}`)
  } catch (error: any) {
    if (error.response?.statusCode === 404) {
      return null
    }
    throw error
  }
}

/**
 * Get Pod logs
 */
export async function getPodLogs(
  namespace: string,
  podName: string,
  container?: string,
  tailLines?: number,
): Promise<string> {
  const apis = getK8sApis()

  try {
    const response = await apis.coreV1Api.readNamespacedPodLog({
      name: podName,
      namespace: namespace,
      container: container,
      follow: false,
      insecureSkipTLSVerifyBackend: false,
      pretty: undefined,
      previous: false,
      sinceSeconds: undefined,
      tailLines: tailLines,
      timestamps: false,
    })

    // readNamespacedPodLog returns string directly
    return response as unknown as string
  } catch (error: any) {
    throw new Error(`Failed to get pod logs: ${error.message}`)
  }
}

/**
 * Execute command in Pod (returns WebSocket URL for actual execution)
 * Note: This only prepares the exec request. Actual execution requires WebSocket handling.
 */
export async function execInPod(
  namespace: string,
  podName: string,
  container: string | undefined,
  command: string[],
): Promise<string> {
  const apis = getK8sApis()

  try {
    // Get the exec URL
    const response = await apis.coreV1Api.connectGetNamespacedPodExec({
      name: podName,
      namespace: namespace,
      command: command.join(' '),
      container: container,
      stderr: false,
      stdin: false,
      stdout: false,
      tty: false,
    })

    // connectGetNamespacedPodExec returns string (URL) directly
    return response as unknown as string
  } catch (error: any) {
    throw new Error(`Failed to exec in pod: ${error.message}`)
  }
}

/**
 * Get events for a specific resource
 */
export async function getEventsForResource(
  kind: string,
  namespace: string,
  name: string,
): Promise<k8s.CoreV1Event[]> {
  const apis = getK8sApis()

  try {
    const fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`
    const response = await apis.coreV1Api.listNamespacedEvent({
      namespace: namespace,
      fieldSelector: fieldSelector,
    })

    // listNamespacedEvent returns CoreV1EventList directly
    const eventList = response as unknown as k8s.CoreV1EventList
    return eventList.items || []
  } catch (error: any) {
    throw new Error(
      `Failed to get events for ${kind}/${name}: ${error.message}`,
    )
  }
}

/**
 * Create a Kubernetes resource
 */
export async function createK8sResource(
  kind: string,
  namespace: string | undefined,
  manifest: any,
): Promise<any> {
  const api = getApiClient(kind)

  try {
    // Namespaced resource
    if (namespace) {
      const method = `createNamespaced${kind}`
      if (typeof (api as any)[method] === 'function') {
        return await (api as any)[method](namespace, manifest)
      }
    }

    // Cluster-scoped resource
    const method = `create${kind}`
    if (typeof (api as any)[method] === 'function') {
      return await (api as any)[method](manifest)
    }

    throw new Error(`No create method found for ${kind}`)
  } catch (error: any) {
    throw new Error(`Failed to create ${kind}: ${error.message}`)
  }
}

/**
 * Update a Kubernetes resource
 */
export async function updateK8sResource(
  kind: string,
  namespace: string | undefined,
  name: string,
  manifest: any,
): Promise<any> {
  const api = getApiClient(kind)

  try {
    // Namespaced resource
    if (namespace) {
      const method = `replaceNamespaced${kind}`
      if (typeof (api as any)[method] === 'function') {
        return await (api as any)[method](name, namespace, manifest)
      }
    }

    // Cluster-scoped resource
    const method = `replace${kind}`
    if (typeof (api as any)[method] === 'function') {
      return await (api as any)[method](name, manifest)
    }

    throw new Error(`No update method found for ${kind}`)
  } catch (error: any) {
    throw new Error(`Failed to update ${kind}: ${error.message}`)
  }
}

/**
 * Delete a Kubernetes resource
 */
export async function deleteK8sResource(
  kind: string,
  namespace: string | undefined,
  name: string,
): Promise<any> {
  const api = getApiClient(kind)

  try {
    // Namespaced resource
    if (namespace) {
      const method = `deleteNamespaced${kind}`
      if (typeof (api as any)[method] === 'function') {
        return await (api as any)[method](name, namespace)
      }
    }

    // Cluster-scoped resource
    const method = `delete${kind}`
    if (typeof (api as any)[method] === 'function') {
      return await (api as any)[method](name)
    }

    throw new Error(`No delete method found for ${kind}`)
  } catch (error: any) {
    throw new Error(`Failed to delete ${kind}: ${error.message}`)
  }
}

/**
 * Get current Kubernetes context
 */
export function getCurrentContext(): string {
  const config = getK8sConfig()
  const currentContext = config
    .getContexts()
    .find(ctx => ctx.name === config.getCurrentContext())
  return currentContext?.name || 'unknown'
}

/**
 * Get all Kubernetes contexts
 */
export function getContexts(): Array<{
  name: string
  cluster: string
  user: string
}> {
  const config = getK8sConfig()
  return config.getContexts().map(ctx => ({
    name: ctx.name,
    cluster: ctx.cluster || '',
    user: ctx.user || '',
  }))
}
