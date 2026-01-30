// app/api/users/[userId]/projects/route.js

import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';
import { decrypt } from '@/lib/crypto';

export async function GET(request) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userIdは必須です' }, { status: 400 });
  }

  const hashedId = hashUserId(userId);
  const dbName = `user_${hashedId}`;
  const client = await getMongoClient();
  const db = client.db(dbName);

  const projects = await db.collection('projects').find({}).toArray();

  const result = projects.map(p => {
    let decryptedUri = '';
    try {
      decryptedUri = decrypt(p.projectUri);
    } catch (err) {
      console.error('URI decrypt failed:', err);
      decryptedUri = '*** failed to decrypt ***';
    }

    return {
      appName: p.appName,
      updatedAt: p.updatedAt,
      projectUri: decryptedUri,
      isConnected: p.isConnected,
    };
  });

  // console.log(result);

  return NextResponse.json(result);
}
