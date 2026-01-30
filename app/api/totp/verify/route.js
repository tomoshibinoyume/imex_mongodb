import { NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import { getMongoClient } from '@/lib/mongodb';
import { decrypt } from '@/lib/crypto';
import { hashUserId } from '@/lib/hash';

export async function POST(request) {
  const { userId, token } = await request.json();

  if (!userId || !token) {
    return NextResponse.json({ error: 'userIdとtokenは必須です' }, { status: 400 });
  }

  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json({ success: false, message: '無効なトークン形式です' }, { status: 400 });
  }

  const client = await getMongoClient();
  const hashedId = hashUserId(userId);
  const dbName = `user_${hashedId}`;
  const db = client.db(dbName);
  const user = await db.collection('totp').findOne({ userId });

  if (!user || !user.totpSecret) {
    return NextResponse.json({ success: false, message: '認証に失敗しました' }, { status: 400 });
  }

  let secret;
  try {
    secret = decrypt(user.totpSecret);
  } catch (e) {
    return NextResponse.json({ success: false, message: '復号に失敗しました' }, { status: 500 });
  }

  authenticator.options = { window: 1 };
  const isValid = authenticator.check(token, secret);

  try {
    await db.collection('totp').updateOne(
      { hashedId },
      {
        $set: {
          totpVerify: isValid,
          updatedAt: new Date(),
          totpVerifiedAt: new Date(),
        }
      }
    );
  } catch (e) {
    return NextResponse.json({ success: false, message: 'DB更新に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({
    success: isValid,
    message: isValid ? '✅ 成功' : '認証に失敗しました',
  });
}
