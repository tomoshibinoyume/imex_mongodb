// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) throw new Error("MONGODB_URI is not defined");

// グローバルにキャッシュ（開発時の再接続防止）
let client;
let clientPromise;

if (!global._mongoClient) {
  client = new MongoClient(uri);
  global._mongoClient = client.connect();
}
clientPromise = global._mongoClient;

export async function getMongoClient() {
  return await clientPromise;
}

export async function getMongoClientWithUri(uri) {
  if (!uri) throw new Error('URIが必要です');
  const client = new MongoClient(uri);
  // console.log('[DEBUG] Connecting to Mongo URI:', uri);
  await client.connect();
  return client;
}
