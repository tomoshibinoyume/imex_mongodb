import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const client = await getMongoClient();
    const hashedId = hashUserId(userId);
    const dbName = `user_${hashedId}`;
    const db = client.db(dbName);

    await db.collection('totp').updateOne(
      { hashedId },
      {
        $set: {
          totpSecret: null,
          totpVerify: false,
          totpDrop: true,
          updatedAt: null,
          totpVerifiedAt: null,
        }
      },
      { upsert: true }
    );

    const user = await db.collection('totp').findOne({ userId });

    return NextResponse.json({
      totpSecret: !!user.totpSecret,
      totpVerify: user.totpVerify ?? false,
      totpDrop: true,
    });

  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
