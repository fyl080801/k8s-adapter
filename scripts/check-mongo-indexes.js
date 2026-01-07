/**
 * Check MongoDB indexes for K8s resources
 * Run with: node scripts/check-mongo-indexes.js
 */

const mongoose = require('mongoose')
require('dotenv').config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/k8s-resources'

async function checkIndexes() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected!\n')

    const db = mongoose.connection.db
    const collections = await db.listCollections().toArray()

    console.log('Checking indexes for all collections:')
    console.log('=====================================\n')

    for (const collection of collections) {
      const collectionName = collection.name
      console.log(`📦 Collection: ${collectionName}`)

      const indexes = await db.collection(collectionName).indexes()

      if (indexes.length === 0) {
        console.log('  ⚠️  No indexes found')
      } else {
        indexes.forEach(index => {
          const indexName = index.name
          const keys = JSON.stringify(index.key)
          const unique = index.unique || false

          console.log(`  ✓ Index: ${indexName}`)
          console.log(`    Keys: ${keys}`)
          if (unique) console.log(`    Unique: ${unique}`)
        })
      }

      // Get document count
      const count = await db.collection(collectionName).countDocuments()
      console.log(`  📊 Total documents: ${count}\n`)
    }

    console.log('=====================================')
    console.log('\nRecommendations:')
    console.log('1. Ensure "namespace" field has an index for all namespaced resources')
    console.log('2. Ensure compound index on { namespace: 1, name: 1 } exists')
    console.log('3. Use .lean() for read-only queries to reduce memory overhead')
    console.log('4. Consider adding index on "createdAt" if sorting by it frequently')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await mongoose.connection.close()
    console.log('\nConnection closed.')
  }
}

checkIndexes()
