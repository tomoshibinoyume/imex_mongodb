import { NextResponse } from 'next/server';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { encrypt } from '@/lib/crypto';
import { hashUserId } from '@/lib/hash';
import { getMongoClient } from '@/lib/mongodb';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("id");
  const hashedId = hashUserId(userId);
  const dbName = `user_${hashedId}`;
  // const email = searchParams.get("email"); // UI側で渡してもOK（任意）
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const secret = authenticator.generateSecret();
  const encryptedSecret = encrypt(secret);
  // const otpauth = authenticator.keyuri(email || userId, 'TOTP_AUTH0_NEXT', secret); // fallback: userId
  // const qr = await QRCode.toDataURL(otpauth);
  const client = await getMongoClient(); // ← 必ず await してから db() を使う
  const db = client.db(dbName);
  await db.collection('totp').updateOne(
    { hashedId },
    {
      $set: {
        userId,
        hashedId,
        totpSecret: encryptedSecret,
        totpVerify: false,
        totpDrop: false,
        updatedAt: new Date(),
      }
    },
    { upsert: true }
  );
  return NextResponse.json({
    totpSecret: secret,
    totpVerify: false,
    totpDrop: false,
  });
  // return NextResponse.json({ secret });
}
