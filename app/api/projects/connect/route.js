// app/api/projects/connect/route.js
import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';
import { decrypt } from '@/lib/crypto';
import { MongoClient } from 'mongodb';

export async function POST(request) {
  const { userId, appName } = await request.json();
  if (!userId || !appName) {
    return NextResponse.json({ error: "userId と appName は必須です" }, { status: 400 });
  }

  const hashedId = hashUserId(userId);
  const dbName = `user_${hashedId}`;
  const client = await getMongoClient();
  const db = client.db(dbName);

  // Step 1: すべて isConnected: false にリセット
  await db.collection('projects').updateMany(
    { userId },
    {
      $set: {
        isConnected: false,
        updatedAt: new Date(),
      }
    }
  );

  // Step 2: 対象だけ isConnected: true に
  const result = await db.collection('projects').updateOne(
    { userId, appName },
    {
      $set: {
        isConnected: true,
        updatedAt: new Date(),
      }
    }
  );

  if (result.modifiedCount === 1) {
    return NextResponse.json({ success: true, message: '接続状態を更新しました' });
  } else {
    return NextResponse.json({ success: false, message: '更新対象が見つかりませんでした' }, { status: 404 });
  }
}
