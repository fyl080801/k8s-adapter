// Keystone Schema Package
// This package contains all Keystone list definitions
// It can be imported by the core application

import { list } from '@keystone-6/core'
import { allowAll } from '@keystone-6/core/access'
import {
  text,
  relationship,
  password,
  timestamp,
  integer,
  select,
} from '@keystone-6/core/fields'
import { document } from '@keystone-6/fields-document'

// Define all lists
export const lists = {
  User: list({
    access: allowAll,

    fields: {
      name: text({ validation: { isRequired: true } }),

      email: text({
        validation: { isRequired: true },
        isIndexed: 'unique',
      }),

      password: password({ validation: { isRequired: true } }),

      posts: relationship({ ref: 'Post.author', many: true }),

      createdAt: timestamp({
        defaultValue: { kind: 'now' },
      }),
    },
  }),

  Post: list({
    access: allowAll,

    fields: {
      title: text({ validation: { isRequired: true } }),

      content: document({
        formatting: true,
        layouts: [
          [1, 1],
          [1, 1, 1],
          [2, 1],
          [1, 2],
          [1, 2, 1],
        ],
        links: true,
        dividers: true,
      }),

      author: relationship({
        ref: 'User.posts',
        ui: {
          displayMode: 'cards',
          cardFields: ['name', 'email'],
          inlineEdit: { fields: ['name', 'email'] },
          linkToItem: true,
          inlineConnect: true,
        },
        many: false,
      }),

      tags: relationship({
        ref: 'Tag.posts',
        many: true,
        ui: {
          displayMode: 'cards',
          cardFields: ['name'],
          inlineEdit: { fields: ['name'] },
          linkToItem: true,
          inlineConnect: true,
          inlineCreate: { fields: ['name'] },
        },
      }),
    },
  }),

  Tag: list({
    access: allowAll,

    ui: {
      isHidden: true,
    },

    fields: {
      name: text(),
      posts: relationship({ ref: 'Post.tags', many: true }),
    },
  }),

  SyncState: list({
    access: allowAll,

    ui: {
      isHidden: false,
      label: 'Sync State',
      description: 'Tracks synchronization status of Kubernetes resources',
    },

    fields: {
      resourceType: text({
        validation: { isRequired: true },
        isIndexed: 'unique',
      }),

      lastSyncTime: timestamp({
        defaultValue: { kind: 'now' },
      }),

      lastSyncDuration: integer({
        db: { map: 'last_sync_duration' },
      }),

      lastSyncCount: integer({
        db: { map: 'last_sync_count' },
      }),

      resourceVersion: text({
        db: { map: 'resource_version' },
      }),

      status: select({
        options: [
          { label: 'Never', value: 'never' },
          { label: 'In Progress', value: 'in_progress' },
          { label: 'Completed', value: 'completed' },
          { label: 'Failed', value: 'failed' },
        ],
        defaultValue: 'never',
        ui: {
          displayMode: 'segmented-control',
        },
      }),

      error: text({
        db: { map: 'error' },
      }),

      informerReconnectCount: integer({
        defaultValue: 0,
        db: { map: 'informer_reconnect_count' },
      }),

      totalResources: integer({
        defaultValue: 0,
        db: { map: 'total_resources' },
      }),

      failedResources: integer({
        defaultValue: 0,
        db: { map: 'failed_resources' },
      }),
    },
  }),
}
