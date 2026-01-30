import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';

export async function POST(request) {
  try {
    const { userId, appName } = await request.json();

    if (!userId || !appName) {
      return NextResponse.json({ message: 'userId と appName は必須です' }, { status: 400 });
    }

    const hashedId = hashUserId(userId);
    const dbName = `user_${hashedId}`;
    const client = await getMongoClient();
    const db = client.db(dbName);
    const collection = db.collection('projects');

    const result = await collection.updateOne(
      { userId, appName },
      {
        $set: {
          isConnected: false,
          updatedAt: new Date(),
        },
      }
    );

    if (result.modifiedCount === 1) {
      return NextResponse.json({ success: true, message: '接続を解除しました' });
    } else {
      return NextResponse.json({ success: false, message: '該当プロジェクトが見つかりませんでした' }, { status: 404 });
    }
  } catch (err) {
    console.error('[DISCONNECT ERROR]', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
