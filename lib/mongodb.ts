import { Db, MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

// Cache connection on globalThis to prevent multiple connections in serverless
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClient?: MongoClient
  _mongoClientPromise?: Promise<MongoClient>
}

function getClientPromise(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    return Promise.reject(new Error('MONGODB_URI is not defined'))
  }

  if (globalWithMongo._mongoClientPromise) {
    return globalWithMongo._mongoClientPromise
  }

  const client = new MongoClient(MONGODB_URI)
  globalWithMongo._mongoClientPromise = client.connect()
  return globalWithMongo._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db('fragments')
}

export async function isMongoAvailable(): Promise<boolean> {
  if (!MONGODB_URI) return false
  try {
    await getClientPromise()
    return true
  } catch {
    return false
  }
}
