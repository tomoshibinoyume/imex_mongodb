import { NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';
import { hashUserId } from '@/lib/hash';

// const TOTP_SESSION_TIMEOUT_MS = 1 * 60 * 1000; // 1分間有効
const TOTP_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30分間有効

export async function POST(request) {
  const body = await request.json();
  const userId = body.id || body.userId;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const client = await getMongoClient();
  const hashedId = hashUserId(userId);
  const dbName = `user_${hashedId}`;
  const db = client.db(dbName);
  const user = await db.collection('totp').findOne({ userId });

  if (!user) {
    return NextResponse.json({ success: false, message: 'Secret not found' }, { status: 400 });
  }

  let totpVerify = user.totpVerify ?? false;

  // 認証済みかつ時間切れの場合は無効にする
  if (totpVerify && user.totpVerifiedAt) {
    const now = Date.now();
    const verifiedAt = new Date(user.totpVerifiedAt).getTime();
    const elapsed = now - verifiedAt;
    // console.log(elapsed);
    if (elapsed > TOTP_SESSION_TIMEOUT_MS) {
      // 無効にする処理（DB更新）
      await db.collection('totp').updateOne(
        { hashedId },
        {
          $set: {
            totpVerify: false,
          },
        }
      );
      totpVerify = false;
    }
  }

  // console.log(user);

  return NextResponse.json({
    totpSecret: !!user.totpSecret,
    totpVerify,
    totpDrop: user.totpDrop ?? true,
  });
}
