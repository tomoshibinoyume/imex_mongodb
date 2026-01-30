// lib/mongodb.js
import { MongoClient } from 'mongodb';

/**
 * グローバルキャッシュ
 *  - key: MongoDB URI
 *  - value: Promise<MongoClient>
 */
if (!global._mongoClientMap) {
  global._mongoClientMap = new Map();
}

/**
 * デフォルト URI（管理用DBなど）
 */
const defaultUri = process.env.MONGODB_URI;
if (!defaultUri) {
  throw new Error('MONGODB_URI is not defined');
}

/**
 * 内部共通関数
 */
async function connectWithCache(uri) {
  if (!uri) throw new Error('MongoDB URI is required');

  if (!global._mongoClientMap.has(uri)) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,   // ← Atlas対策（重要）
    });

    const clientPromise = client.connect();
    global._mongoClientMap.set(uri, clientPromise);
  }

  return await global._mongoClientMap.get(uri);
}

/**
 * デフォルト URI 用
 */
export async function getMongoClient() {
  return await connectWithCache(defaultUri);
}

/**
 * 任意 URI 用（プロジェクト切り替え）
 */
export async function getMongoClientWithUri(uri) {
  return await connectWithCache(uri);
}
