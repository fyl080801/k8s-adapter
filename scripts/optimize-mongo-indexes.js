/**
 * Optimize MongoDB indexes for K8s resources
 * This script creates optimized indexes for multi-namespace queries with sorting
 * Run with: node scripts/optimize-mongo-indexes.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/k8s-resources'

// Resources that need optimization (namespaced resources with list queries)
const NAMESPACED_RESOURCES = [
  'Pod',
  'Deployment',
  'Service',
  'ConfigMap',
  'Secret',
  'DaemonSet',
  'StatefulSet',
  'Ingress',
  'PersistentVolumeClaim',
  'Event',
]

async function optimizeIndexes() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected!\n')

    const db = mongoose.connection.db

    console.log('Optimizing indexes for namespaced resources:')
    console.log('==========================================\n')

    for (const resourceName of NAMESPACED_RESOURCES) {
      const collectionName = resourceName.toLowerCase() + 's' // e.g., 'pods'
      console.log(`📦 Optimizing: ${resourceName} (collection: ${collectionName})`)

      const collection = db.collection(collectionName)

      // Get existing indexes
      const existingIndexes = await collection.indexes()
      const existingIndexNames = existingIndexes.map(idx => idx.name)

      console.log('  Existing indexes:', existingIndexNames.join(', '))

      // Create compound index for: namespace filter + createdAt sort
      // This optimizes queries like: find({ namespace: { $in: [...] } }).sort({ createdAt: -1 })
      const compoundIndexSpec = { namespace: 1, createdAt: -1 }
      const compoundIndexName = 'namespace_1_createdAt_-1'

      if (!existingIndexNames.includes(compoundIndexName)) {
        console.log(`  ➕ Creating compound index: { namespace: 1, createdAt: -1 }`)
        await collection.createIndex(compoundIndexSpec, {
          name: compoundIndexName,
          background: true, // Don't block other operations
        })
        console.log(`  ✅ Index created: ${compoundIndexName}`)
      } else {
        console.log(`  ✓ Index already exists: ${compoundIndexName}`)
      }

      // Verify index is being used
      const explainPlan = await collection
        .find({ namespace: { $in: ['default', 'kube-system'] } })
        .sort({ createdAt: -1 })
        .limit(10)
        .explain('executionStats')

      const indexUsed = explainPlan.executionStages?.indexUsedStage || 'COLLSCAN'
      const docsExamined = explainPlan.executionStats?.totalDocsExamined || 0

      console.log(`  📊 Query analysis:`)
      console.log(`     Index used: ${indexUsed}`)
      console.log(`     Docs examined: ${docsExamined}`)

      if (indexUsed === 'COLLSCAN') {
        console.log(`  ⚠️  WARNING: Collection scan! Query may be slow without proper index.`)
      } else {
        console.log(`  ✅ Using index scan (efficient)`)
      }

      // Get collection stats
      const stats = await collection.stats()
      console.log(`  📊 Collection size: ${(stats.size / 1024).toFixed(2)} KB`)
      console.log(`  📊 Document count: ${stats.count}\n`)
    }

    console.log('==========================================')
    console.log('\n✅ Index optimization complete!')
    console.log('\nNext steps:')
    console.log('1. Restart your application')
    console.log('2. Test queries again with multi-namespace filters')
    console.log('3. Query time should be significantly reduced (from 12s to <100ms)')
  } catch (error) {
    console.error('❌ Error:', error)
    if (error.message.includes('ns does not exist')) {
      console.log('\n💡 Some collections may not exist yet. Start the application first to create them.')
    }
  } finally {
    await mongoose.connection.close()
    console.log('\nConnection closed.')
  }
}

optimizeIndexes()
