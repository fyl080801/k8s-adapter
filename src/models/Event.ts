import { V1Event } from '@kubernetes/client-node'
import {
  createK8sSchema,
  createK8sModel,
  createTransformer,
  BaseK8sDocument,
} from '../lib/k8s-schema-helper'

/**
 * Event document interface extending base K8s document
 */
export interface IEvent extends BaseK8sDocument {
  type: string
  reason?: string
  message?: string
  source: {
    component?: string
    host?: string
  }
  involvedObject: {
    kind?: string
    namespace?: string
    name?: string
    uid?: string
  }
  firstTimestamp?: Date
  lastTimestamp?: Date
  count: number
}

/**
 * Define Event-specific fields
 */
const EVENT_FIELDS = {
  type: { type: String, required: true },
  reason: { type: String },
  message: { type: String },
  source: {
    component: { type: String },
    host: { type: String },
  },
  involvedObject: {
    kind: { type: String },
    namespace: { type: String },
    name: { type: String },
    uid: { type: String },
  },
  firstTimestamp: { type: Date },
  lastTimestamp: { type: Date },
  count: { type: Number, default: 0 },
}

/**
 * Create Event schema with type safety
 */
const EventSchema = createK8sSchema<IEvent>('Event', EVENT_FIELDS, [
  { type: 1, reason: 1 },
  { lastTimestamp: -1 },
])

/**
 * Transform V1Event to IEvent document using official K8s types
 */
export const transformEvent = createTransformer<IEvent>((event: V1Event) => {
  return {
    type: event.type || 'Normal',
    reason: event.reason,
    message: event.message,
    source: {
      component: event.source?.component,
      host: event.source?.host,
    },
    involvedObject: {
      kind: event.involvedObject?.kind,
      namespace: event.involvedObject?.namespace,
      name: event.involvedObject?.name,
      uid: event.involvedObject?.uid,
    },
    firstTimestamp: event.firstTimestamp
      ? new Date(event.firstTimestamp)
      : undefined,
    lastTimestamp: event.lastTimestamp
      ? new Date(event.lastTimestamp)
      : undefined,
    count: event.count || 0,
  }
})

/**
 * Create or retrieve Event model
 */
export default createK8sModel<IEvent>('Event', EventSchema, transformEvent)
