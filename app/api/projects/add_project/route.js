import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { encrypt } from '@/lib/crypto';
import { hashUserId, hashProjectUri } from '@/lib/hash';

export async function POST(request) {
  const { id: userId, email, project: projectUri, appName: name } = await request.json();

  if (!userId || !projectUri || !name) {
    return NextResponse.json({ error: "userId, project, appName は必須です" }, { status: 400 });
  }

  const encryptedProjectUri = encrypt(projectUri);
  const projectHashUri = hashProjectUri(projectUri);
  const hashedId = hashUserId(userId);
  const dbName = `user_${hashedId}`;
  const client = await getMongoClient();
  const db = client.db(dbName);

  // 🔍 projectUri の重複チェック
  const existingByUri = await db.collection('projects').findOne({ projectHashUri });
  if (existingByUri) {
    return NextResponse.json({
      success: false,
      message: 'このプロジェクトURIはすでに登録されています。',
    }, { status: 409 });
  }

  // 🔍 appName の重複チェック
  const existingByAppName = await db.collection('projects').findOne({ appName: name });
  if (existingByAppName) {
    return NextResponse.json({
      success: false,
      message: 'このアプリ名はすでに使用されています。',
    }, { status: 409 });
  }

  // ✅ 登録処理
  await db.collection('projects').insertOne({
    userId,
    hashedId,
    appName: name,
    projectUri: encryptedProjectUri,
    projectHashUri,
    isConnected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return NextResponse.json({
    success: true,
    message: 'プロジェクトを登録しました',
  });
}
