# Cleanup Scripts

This directory contains scripts for maintaining the MongoDB database.

## cleanup-null-uid.js

Removes documents with null or undefined `uid` values from all collections. This fixes the duplicate key error:
```
E11000 duplicate key error collection: k8s-resources.nodes index: uid_1 dup key: { uid: null }
```

### Usage

```bash
# Make sure MongoDB is running
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongod  # Linux

# Run the cleanup script
node scripts/cleanup-null-uid.js
```

### What it does

1. Connects to MongoDB (uses `MONGODB_URI` from `.env` or defaults to `mongodb://localhost:27017/k8s-resources`)
2. Scans all collections in the database
3. Finds documents where `uid` is null or undefined
4. Deletes those documents
5. Reports the number of documents deleted per collection

### When to run

Run this script if you see the duplicate key error during application startup. This typically happens when:
- The schema structure has changed
- Old data exists that doesn't conform to the new schema
- Documents were created without proper validation

### After running

After running the cleanup script, restart your application:

```bash
npm run dev
```

The application should start without the duplicate key error.
