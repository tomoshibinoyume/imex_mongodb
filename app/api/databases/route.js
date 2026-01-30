import { NextResponse } from 'next/server';
import { getMongoClientWithUri } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';
import { decrypt } from '@/lib/crypto';

export async function GET(request) {
  const url = new URL(request.url);
  const encryptedUri = url.searchParams.get('projectUri');
  if (!encryptedUri) {
    return NextResponse.json({ error: 'projectUriが必要です' }, { status: 400 });
  }

  try {
    const projectUri = decrypt(decodeURIComponent(encryptedUri)); // ←ここdecodeURIComponentを忘れずに
    const client = await getMongoClientWithUri(projectUri);

    const dbs = await client.db().admin().listDatabases();
    const excluded = ['admin', 'local', 'config'];
    const names = dbs.databases
      .map(db => db.name)
      .filter(name => !excluded.includes(name));

    return NextResponse.json(names);
  } catch (err) {
    console.error('DB取得失敗', err);
    return NextResponse.json({ error: '取得失敗' }, { status: 500 });
  }
}
