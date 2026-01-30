// app/api/projects/is-connected/route.js

import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';

export async function GET(request) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userIdは必須です' }, { status: 400 });
  }

  const client = await getMongoClient();
  const db = client.db(`user_${hashUserId(userId)}`);

  const connectedProjects = await db
    .collection('projects')
    .find({ isConnected: true })
    .toArray();

  return NextResponse.json(connectedProjects);
}
