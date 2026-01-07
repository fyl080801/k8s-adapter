/**
 * Cleanup metadata.uid index from all collections
 *
 * This script removes the redundant 'metadata.uid_1' index that conflicts
 * with the flattened 'uid' field.
 *
 * Run after updating schema to prevent E11000 duplicate key errors
 */

const mongoose = require('mongoose')

require('dotenv').config()

const COLLECTIONS = [
  'pods',
  'deployments',
  'services',
  'nodes',
  'statefulsets',
  'daemonsets',
  'configmaps',
  'secrets',
  'ingresses',
  'persistentvolumeclaims',
  'persistentvolumes',
  'events',
  'customresourcedefinitions',
]

async function cleanupIndexes() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    const db = mongoose.connection.db

    for (const collectionName of COLLECTIONS) {
      try {
        const collections = await db
          .listCollections({ name: collectionName })
          .toArray()

        if (collections.length === 0) {
          console.log(`⏭️  Collection '${collectionName}' does not exist, skipping...`)
          continue
        }

        const collection = db.collection(collectionName)
        const indexes = await collection.indexes()

        console.log(`\n📋 Checking indexes for '${collectionName}':`)

        // Find and remove metadata.uid index
        const metadataUidIndex = indexes.find(
          idx => idx.key && idx.key['metadata.uid'] === 1,
        )

        if (metadataUidIndex) {
          const indexName = metadataUidIndex.name
          console.log(`   ❌ Found redundant index: ${indexName}`)
          console.log(`   🔧 Dropping index '${indexName}'...`)

          await collection.dropIndex(indexName)
          console.log(`   ✅ Successfully dropped index '${indexName}'`)
        } else {
          console.log(`   ✅ No 'metadata.uid' index found (good!)`)
        }

        // Display current indexes
        console.log(`   📊 Current indexes:`)
        indexes.forEach(idx => {
          console.log(`      - ${idx.name}: ${JSON.stringify(idx.key)}`)
        })
      } catch (error) {
        console.error(`❌ Error processing collection '${collectionName}':`, error.message)
      }
    }

    console.log('\n✅ Index cleanup completed')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
  }
}

cleanupIndexes()
