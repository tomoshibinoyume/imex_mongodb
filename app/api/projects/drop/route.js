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

    const result = await collection.deleteOne({ userId, appName });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: '削除対象が見つかりませんでした' }, { status: 404 });
    }

    return NextResponse.json({ message: '削除に成功しました' });
  } catch (err) {
    console.error('[DELETE PROJECT ERROR]', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
