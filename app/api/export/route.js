import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { getMongoClientWithUri } from '@/lib/mongodb';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dbName = searchParams.get("db");
    const colName = searchParams.get("col");
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const encryptedUri = searchParams.get("projectUri");

    if (!encryptedUri || !dbName || !colName) {
      return NextResponse.json({ error: 'Missing projectUri, db or col' }, { status: 400 });
    }

    const projectUri = decrypt(decodeURIComponent(encryptedUri));
    const client = await getMongoClientWithUri(projectUri);
    const db = client.db(dbName);
    const posts = await db.collection(colName)
      .find({})
      .skip(skip)
      .limit(limit)
      .toArray();

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
