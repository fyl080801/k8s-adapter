/**
 * Cleanup invalid records from MongoDB
 * This script removes records with null/undefined uid or name fields
 * Updated to handle flattened uid field at top level
 */

const mongoose = require('mongoose')

require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/k8s-resources'

async function cleanup() {
  try {
    console.log('🔗 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    const db = mongoose.connection.db

    // List of collections to clean
    const collections = [
      'events',
      'configmaps',
      'pods',
      'services',
      'deployments',
      'statefulsets',
      'daemonsets',
      'ingresses',
      'persistentvolumeclaims',
      'persistentvolumes',
      'nodes',
      'secrets',
      'customresourcedefinitions',
    ]

    let totalDeleted = 0

    for (const collectionName of collections) {
      const collection = db.collection(collectionName)

      // Delete documents with null uid (flattened at top level) or name
      const result = await collection.deleteMany({
        $or: [
          { uid: null },
          { uid: { $exists: false } },
          { name: null },
          { name: { $exists: false } },
        ],
      })

      if (result.deletedCount > 0) {
        console.log(`🗑️  Deleted ${result.deletedCount} invalid records from ${collectionName}`)
        totalDeleted += result.deletedCount
      }
    }

    if (totalDeleted === 0) {
      console.log('✅ No invalid records found')
    } else {
      console.log(`✅ Total deleted: ${totalDeleted} invalid records`)
    }

    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

cleanup()
