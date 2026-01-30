// import { client } from '@/lib/mongodb';
import { NextResponse } from 'next/server';
// import clientPromise from "@/lib/mongodb";
import { getMongoClientWithUri } from '@/lib/mongodb';
import { decrypt } from '@/lib/crypto';

export async function POST(req) {
  const { dbName, encryptedUri } = await req.json();
  // console.log(dbName, encryptedUri);
  const projectUri = decrypt(decodeURIComponent(encryptedUri)); // ←ここdecodeURIComponentを忘れずに
  const client = await getMongoClientWithUri(projectUri);
  const db = client.db(dbName);
  const colArray = [];
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const collection = db.collection(col.name);
    // 件数の取得
    const count = await collection.estimatedDocumentCount();
    // サイズ取得（$collStats 経由）
    const stats = await collection.aggregate([
      { $collStats: { storageStats: {} } }
    ]).toArray();
    const size = stats[0]?.storageStats?.size || 0;
    // 1件サンプル取得し、JSON文字列に変換 → バイト数算出
    let sampleDocSize = 0;
    const doc = await collection.findOne();
    if (doc) {
      const jsonStr = JSON.stringify(doc);
      sampleDocSize = Buffer.byteLength(jsonStr, 'utf-8');
    }
    colArray.push({
      name: col.name,
      size,
      count,
      sampleDocSize
    });
  }
  return NextResponse.json({ colArray });
}
