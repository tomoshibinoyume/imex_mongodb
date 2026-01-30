'use client';
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import styles from "../../page.module.css";

export default function TotpSetupPage() {
  const { data: session, status } = useSession();
  const [secretKey, setSecretKey] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(true);
  const [showVerify, setShowVerify] = useState(false);
  const [token, setToken] = useState('');
  //
  const [totpSecret, setTotpSecret] = useState(null);
  const [totpVerify, setTotpVerify] = useState(false);
  const [totpDrop, setTotpDrop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // ユーザーデータ取得
  const fetchTotpVerify = async (id, email) => {
    try {
      const res = await fetch("/api/totp/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, email }),
      });
      if (!res.ok) {
        throw new Error("Fetch failed");
      }
      const data = await res.json();
      // console.log(data);
      setTotpSecret(data?.totpSecret ?? false);
      setTotpVerify(data?.totpVerify ?? false);
      setTotpDrop(data?.totpDrop);
      if(data?.totpDrop) {
        setIsLoading(false);
        return;
      }
      if (!data?.totpVerify) {
        router.push("/");
        return;
      }
      setIsLoading(false);
    } catch (e) {
      // console.log("TOTP info fetch error:", e);
      setTotpSecret(false);
      setTotpVerify(false);
      router.push("/");
    }
  };


  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || !session?.user?.id || !session?.user?.email) {
      router.push("/");
      return;
    }
    fetchTotpVerify(session.user.id, session.user.email);
  }, [session, status, router]);

  const fetchQRCode = async () => {
    const res = await fetch(`/api/totp/setup?id=${encodeURIComponent(session.user.id)}&email=${encodeURIComponent(session.user.email)}`);
    if (!res.ok) {
      console.error("Failed to get QR code");
      return;
    }
    const data = await res.json();
    // console.log(data);
    setSecretKey(data.totpSecret);
    setTotpSecret(data.totpSecret ?? false);
    setTotpVerify(data.totpVerify);
    setTotpDrop(data.totpDrop);
    const otpauth = authenticator.keyuri(session.user.email, process.env.NEXT_PUBLIC_APP_NAME, data.totpSecret);
    const qrImageUrl = await QRCode.toDataURL(otpauth);
    setQrCode(qrImageUrl);
  };

  const handleSetupMfa = async () => {
    fetchQRCode();
    setShowQrCode(true);
    setShowSecretKey(false);
    setShowVerify(false);
  };

  const handleSetupQrcode = async () => {
    setShowQrCode(true);
    setShowSecretKey(false);
    setShowVerify(false);
  };

  const handleSetupSecretKey = async () => {
    setShowQrCode(false);
    setShowSecretKey(true);
    setShowVerify(false);
  };

  const handleShowVerifyMfa = async () => {
    setShowQrCode(false);
    setShowSecretKey(false);
    setShowVerify(true);
  }

  const handleClipboardSecretKey = async () => {
    await navigator.clipboard.writeText(secretKey);
    alert(`シークレットキーをコピーしました。`);
  }

  const handleClipboardCodeName = async () => {
    await navigator.clipboard.writeText(process.env.NEXT_PUBLIC_APP_NAME + ': ' + session.user.email);
    alert(`コード名「` + process.env.NEXT_PUBLIC_APP_NAME + `」をコピーしました。`);
  }

  const handleFocus = async () => {
    const text = await navigator.clipboard.readText();
    const sliced = text.slice(0, 6);
    if (/^\d+$/.test(sliced)) {
      setToken(sliced);
    }
  }


  const handleVerifyMfa = async () => {
    // console.log('handleVerifyMfa =>');
    const res = await fetch('/api/totp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: session.user.id,
        token: token,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      // console.log("2FAトークン検証に失敗しました:", data.message);
      setToken('');
      alert(data.message || "トークンの検証に失敗しました");
      return;
    }
    // 成功した場合、UIリセット
    setSecretKey(null);
    setQrCode(null);
    setShowQrCode(false);
    setShowSecretKey(false);
    setShowVerify(false);
    setToken('');
    router.push("/");
    // alert("✅ MFA 検証成功しました！");
  }

  const handleDropMfa = async () => {
    try {
      // console.log('handleDropMfa', session.user.id);
      const res = await fetch('/api/totp/drop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id, // ※ 'id' キーを使う
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Error:', data.error);
        alert('TOTP設定の解除に失敗しました');
        return;
      }
      // console.log('Drop MFA result:', data);
      setSecretKey(null);
      setQrCode(null);
      setShowQrCode(false);
      setShowSecretKey(false);
      // console.log(data);
      setTotpSecret(data?.totpSecret);
      setShowVerify(data?.totpVerify);
      setTotpDrop(data?.totpDrop);
      alert('MFAが解除されました');

      // 画面更新やステータス更新があればここで実施
    } catch (err) {
      console.error('Request failed', err);
      alert('エラーが発生しました');
    }
  };

  return (
    <div className="grid items-center justify-items-center min-h-screen px-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-[20px] row-start-2 items-center items-start">
    <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
    <Link href="/">
    <Image
    className="dark:invert"
    src="/next.svg"
    alt="Next.js logo"
    width={180}
    height={38}
    priority
    />
    </Link>
    <Link href="/">
    <Image
    className={styles.logo}
    src="/MongoDB_SlateBlue.svg"
    alt="MongoDB logo"
    width={180}
    height={38}
    priority
    />
    </Link>
    </div>

    {status === "loading" || isLoading ? (
      <div className={`${styles.ctas} m-auto text-center`}>
      読み込み中...
      </div>
    ) : session ? (
      <>
      <div className={`${styles.ctas} m-auto underline`}>
      <Link href="/setting">
      <Image
      className={`${styles.logo} mr-2`}
      src="/gear-solid.svg"
      alt="gear-solid"
      width={15}
      height={15}
      />
      setting
      </Link>
      </div>
      <div className={`${styles.ctas} m-auto text-center`}>
      <p>ようこそ、{session.user.name} さん</p>
      </div>
      <div className={`${styles.ctas} m-auto text-center`}>
      <p>
      多要素認証：
      {totpVerify && totpSecret && (
        <>
        <span>設定済み</span>
        <span className="ml-3 text-sm cursor-pointer underline" onClick={handleDropMfa}>解除する</span>
        </>
      )}
      {!totpVerify && totpSecret && (
        <>
        <span>設定済み・認証待ち</span>
        <span className="ml-3 text-sm cursor-pointer underline" onClick={handleDropMfa}>解除する</span>
        </>
      )}
      {totpDrop && (
        <>
        <span>設定されていません</span>
        </>
      )}
      </p>
      </div>
      <div className="flex-grow flex gap-4 w-full">
      <div className="w-2/3 m-auto">
      <button className="w-full text-sm" onClick={handleSetupMfa}>{totpVerify ? 'シークレットキーの再発行' : 'シークレットキーの発行'}</button>
      </div>
      </div>
      <div className="flex-grow flex gap-4 w-full">
      <div className="w-1/2">
      <button className="w-full text-sm" disabled={!qrCode} onClick={handleSetupQrcode}>QRコード</button>
      </div>

      <div className="w-1/2">
      <button className="w-full text-sm" disabled={!secretKey} onClick={handleSetupSecretKey}>シークレットキー</button>
      </div>
      </div>

      {showQrCode && qrCode  && (
        <>
        <p>以下のQRコードをAuthenticatorアプリでスキャンしてください。</p>
        <div className="m-auto">
        <Image
        className="m-auto"
        src={qrCode}
        alt="QRコード"
        width={120}
        height={120}
        priority
        />
        </div>
        <button className="w-1/2 text-sm mt-7 m-auto" onClick={handleShowVerifyMfa}>認証</button>
        </>
      )}

      {showSecretKey && (
        <div className="text-center">
        <p className="mb-5">以下のコード名とシークレットキーをAuthenticatorアプリに入力して下さい。</p>
        <p className="mb-3 text-sm">コード名（任意）</p>
        <button className="mb-3 w-[200]" onClick={handleClipboardCodeName}>
        {process.env.NEXT_PUBLIC_APP_NAME}
        </button>
        <p className="my-3 text-sm">シークレットキー</p>
        <div className="w-full">
        <button className="w-auto" onClick={handleClipboardSecretKey}>
        {secretKey}
        </button>
        </div>
        <button className="w-1/2 text-sm mt-7" onClick={handleShowVerifyMfa}>認証</button>
        </div>
      )}

      {showVerify && (
        <div className="w-full">
        <p className="text-center mb-5">6桁のコードを入力して下さい。</p>
        <input
        className="mx-auto block text-center w-[158px] mb-5 py-1 input-code"
        type="text"
        minLength="6"
        maxLength="6"
        placeholder="123456"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        />
        <div className="w-full flex justify-center mt-4">
        <button className="w-1/2 text-sm" disabled={!(token.length === 6 && /^\d+$/.test(token))} onClick={handleVerifyMfa}>送信</button>
        </div>
        <p className="text-center mt-5">認証切れ：30分</p>
        </div>
      )}
      </>
    ) : (
      <>
      <div className={`${styles.ctas} m-auto mt-5`}>
      <button
      onClick={() => signIn("auth0")}
      className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
      >
      ログイン
      </button>
      </div>
      </>
    )}
    </main>

    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
    This is MFA page.
    </footer>
    </div>
  );
}
