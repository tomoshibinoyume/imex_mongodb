// app/api/disconnect/route.js
import { NextResponse } from 'next/server';
// import { client } from '@/lib/mongodb';
import { getMongoClient } from '@/lib/mongodb';

export async function POST() {
  try {
    await getMongoClient.close();
    console.log("MongoDB接続を切断しました");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MongoDB切断失敗:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
