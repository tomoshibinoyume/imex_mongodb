import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { getMongoClientWithUri } from '@/lib/mongodb';


export async function POST(req) {
  try {
    const body = await req.json();
    console.log('body', body);
    let { dbName, colName, encryptedUri } = body;
    // 安全のため "_drop" が付いていれば取り除く
    if (dbName.endsWith('_drop')) {
      dbName = dbName.replace(/_drop$/, '');
    }
    if (colName?.endsWith('_drop')) {
      colName = colName.replace(/_drop$/, '');
    }
    const projectUri = decrypt(decodeURIComponent(encryptedUri));
    const client = await getMongoClientWithUri(projectUri);
    const db = client.db(dbName);
    if (!colName) {
      await db.dropDatabase();
      return NextResponse.json({ message: `Database '${dbName}' has been dropped.` });
    } else {
      const collections = await db.listCollections({ name: colName }).toArray();
      if (collections.length === 0) {
        return NextResponse.json({ error: `Collection '${colName}' does not exist.` }, { status: 400 });
      }
      const collection = db.collection(colName);
      await collection.drop();
      return NextResponse.json({ message: `Collection '${colName}' has been dropped.` });
    }
  } catch (err) {
    console.error('削除処理失敗:', err);
    return NextResponse.json({ error: '削除中にエラーが発生しました' }, { status: 500 });
  }
}
