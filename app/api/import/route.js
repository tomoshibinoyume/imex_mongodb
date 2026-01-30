import { NextResponse } from 'next/server';
import { getMongoClientWithUri } from '@/lib/mongodb';
import { decrypt } from '@/lib/crypto';

export async function POST(req) {
  try {
    const body = await req.json();
    const { encryptedUri, dbName, colName, docs } = body;

    // バリデーション
    if (!dbName || !colName || !Array.isArray(docs) || docs.length === 0) {
      return NextResponse.json(
        { error: 'dbName、colName、および非空の docs 配列が必要です' },
        { status: 400 }
      );
    }

    // 接続URI復号 → MongoDB接続
    const projectUri = decrypt(decodeURIComponent(encryptedUri));
    const client = await getMongoClientWithUri(projectUri);
    const db = client.db(dbName);
    const collection = db.collection(colName);

    // _id を除外して挿入（重複回避）
    const sanitizedDocs = docs.map(({ _id, ...rest }) => rest);
    const result = await collection.insertMany(sanitizedDocs);

    return NextResponse.json(
      { insertedCount: result.insertedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error('インポート失敗:', err);
    return NextResponse.json(
      { error: err.message || 'インポート中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
