'use client';
import Image from "next/image";
import Link from 'next/link';
import QRCode from 'qrcode';
import { useIsIOSMobile } from '@/lib/useIsIosMobile';
import { authenticator } from 'otplib';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import styles from "./page.module.css";

export default function Home() {
  const { data: session, status } = useSession();
  const [connectedProjects, setConnectedProjects] = useState([]);
  const [secretKey, setSecretKey] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showQrCode, setShowQrCode] = useState(true);
  const [showVerify, setShowVerify] = useState(false);
  const [totpVerify, setTotpVerify] = useState(null);
  const [totpSecret, setTotpSecret] = useState(null);
  const [totpDrop, setTotpDrop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState('');
  const router = useRouter();
  const isIOSMobile = useIsIOSMobile();
  const [signInLoading, setSignInLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;

    const userId = session?.user?.id;
    const email = session?.user?.email;

    if (!userId || !email) return;

    fetchConnectedProjects(userId);
    fetchTotpVerify(userId, email);
  }, [session, status]);

  const fetchConnectedProjects = async (id) => {
    try {
      const res = await fetch(`/api/projects/is-connected?userId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("接続中のプロジェクト取得に失敗しました");
      const data = await res.json();
      // console.log(data);
      setConnectedProjects(data);
    } catch (err) {
      console.error("fetchConnectedProjects error:", err);
      setConnectedProjects([]);
    }
  };

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
        // console.log('error');
        throw new Error("Fetch failed");
      }

      const data = await res.json();
      setTotpSecret(data?.totpSecret ?? false);
      setTotpVerify(data?.totpVerify ?? false);
      setTotpDrop(data?.totpVerify);
    } catch (e) {
      // console.log("TOTP info fetch error:", e);
      setTotpSecret(false);
      setTotpVerify(false);
      // setTotpDrop(true); // ユーザー情報がない時にこれがtrueだとkey発行画面が出ない
    } finally {
      setIsLoading(false);
    }
  };


  const fetchQRCode = async () => {
    const res = await fetch(`/api/totp/setup?id=${encodeURIComponent(session.user.id)}&email=${encodeURIComponent(session.user.email)}`);
    if (!res.ok) {
      // console.log("QRコードの取得に失敗しました");
      alert("QRコードの取得に失敗しました。");
      return;
    }
    const data = await res.json();
    setSecretKey(data.totpSecret);
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
    setTotpSecret(true);
  }

  const handleBackSecretKey = async () => {
    setShowQrCode(true);
    setShowSecretKey(false);
    setTotpSecret(false);
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
    if(isIOSMobile){
      const text = await navigator.clipboard.readText();
      const sliced = text.slice(0, 6);
      if (/^\d+$/.test(sliced)) {
        setToken(sliced);
      }
    }
  }

  const handleVerifyMfa = async () => {
    setIsLoading(true);
    try {
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
      setToken('');
      if (!res.ok) {
        // HTTPエラー（400, 500 など）
        setIsLoading(false);
        alert(data.message || 'サーバーエラーが発生しました');
        return;
      }

      if (data.success) {
        // alert('✅ 認証成功');
      } else {
        setIsLoading(false);
        alert('❌ 認証失敗');
      }
      fetchTotpVerify(session.user.id, session.user.email);
      router.refresh();
    } catch (error) {
      console.error('handleVerifyMfa error:', error);
      setIsLoading(false);
      alert('通信エラーが発生しました');
    } finally {
      // setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    // console.log('handleSignIn');
    try{
      setSignInLoading(false);
      await signIn('auth0');
    } catch (error) {
      setSignInLoading(true);
      console.error('handleSignIn error:', error);
      alert('通信エラーが発生しました');
    } finally {
      setSignInLoading(false);
    }
  }


  if (status === "loading") {
    return (
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center items-start">
      <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
      <Image
      className="dark:invert"
      src="/next.svg"
      alt="Next.js logo"
      width={180}
      height={38}
      priority
      />
      <Image
      className={styles.logo}
      src="/MongoDB_SlateBlue.svg"
      alt="MongoDB logo"
      width={180}
      height={38}
      priority
      />
      </div>
      <div className="row-start-3 flex justify-center w-full">
        <p className={`${styles.ctas} text-center`}>読み込み中...</p>
      </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">

      </footer>
      </div>
    );
  }

  if (status !== "authenticated" || !session) {
    return (
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center items-start">
      <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
      <Image
      className="dark:invert"
      src="/next.svg"
      alt="Next.js logo"
      width={180}
      height={38}
      priority
      />
      <Image
      className={styles.logo}
      src="/MongoDB_SlateBlue.svg"
      alt="MongoDB logo"
      width={180}
      height={38}
      priority
      />
      </div>
      <div className={`${styles.ctas} m-auto`}>
      {signInLoading ? (
        <button onClick={handleSignIn} className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto">
        ログイン
        </button>
      ) : (
        <p>ログインしています...</p>
      )}
      </div>
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">

      </footer>
      </div>
    );
  }

  if (!totpSecret && !totpVerify && !totpDrop) {
    return (
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center items-start">
      <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
      <Image
      className="dark:invert"
      src="/next.svg"
      alt="Next.js logo"
      width={180}
      height={38}
      priority
      />
      <Image
      className={styles.logo}
      src="/MongoDB_SlateBlue.svg"
      alt="MongoDB logo"
      width={180}
      height={38}
      priority
      />
      </div>
      {isLoading ? (
        <>
        <div className="row-start-3 flex justify-center w-full">
          <p className={`${styles.ctas} text-center`}>読み込み中...</p>
        </div>
        </>
      ) : (
        <>
        <div className="flex-grow flex gap-4 w-full">
        <div className="w-2/3 m-auto">
        <button className="w-full text-sm" onClick={handleSetupMfa}>シークレットキーの発行</button>
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
          </div>
        )}
        <button className="w-1/2 text-sm m-auto" onClick={handleShowVerifyMfa}>認証</button>
        </>
      )}
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">

      </footer>
      </div>
    );
  }

  if (totpSecret && !totpVerify && !totpDrop) {
    return (
      <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center items-start">
      <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
      <Image
      className="dark:invert"
      src="/next.svg"
      alt="Next.js logo"
      width={180}
      height={38}
      priority
      />
      <Image
      className={styles.logo}
      src="/MongoDB_SlateBlue.svg"
      alt="MongoDB logo"
      width={180}
      height={38}
      priority
      />
      </div>
      <div className="w-full">
      {isLoading ? (
        <p className="text-center mb-30">しばらくお待ちください。</p>
      ) : (
        <>
        <p className="text-center mb-5">6桁のコードを入力して下さい。</p>
        <input
        className="mx-auto block text-center w-[158px] mb-5 py-1 input-code"
        type="text"
        minLength="6"
        maxLength="6"
        placeholder="123456"
        value={token}
        onFocus={handleFocus}
        onChange={(e) => setToken(e.target.value)}
        />
        <div className="w-full flex justify-center mt-4">
        <button className="w-1/2 text-sm" disabled={!(token.length === 6 && /^\d+$/.test(token))} onClick={handleVerifyMfa}>
        送信
        </button>
        </div>
        <p className="text-center mt-5">認証切れ：30分</p>
        <div className="w-full flex justify-center mt-4">
        <button className="w-1/2 text-sm" onClick={handleBackSecretKey}>
        シークレットキーの再発行
        </button>
        </div>
        </>
      )}
      </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">

      </footer>
      </div>
    );
  }


  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-[15px] row-start-2 items-center items-start">
    <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
    <Image
    className="dark:invert"
    src="/next.svg"
    alt="Next.js logo"
    width={180}
    height={38}
    priority
    />
    <Image
    className={styles.logo}
    src="/MongoDB_SlateBlue.svg"
    alt="MongoDB logo"
    width={180}
    height={38}
    priority
    />
    </div>

    <div className={`${styles.ctas} m-auto text-center mt-5`}>
    <p>ようこそ、{session.user.name} さん</p>
    </div>
    <div className={`${styles.ctas} m-auto text-center mb-5`}>
    {connectedProjects.length > 0 ? (
      connectedProjects.map(p => (
        <p key={p.appName} className="rounded">
        ✅ 接続中：{p.appName}
        </p>
      ))
    ) : (
      <p className="text-sm text-gray-500">現在接続中のプロジェクトはありません。</p>
    )}
    </div>
    <div className={`${styles.ctas} m-auto`}>
    <Link href="/export" className={styles.secondary}>
    <Image
    className={styles.logo}
    src="/file-export-solid.svg"
    alt="mongodb-file-export-solid"
    width={20}
    height={20}
    />
    export
    </Link>
    <Link href="/import" className={styles.secondary}>
    <Image
    className={styles.logo}
    src="/file-import-solid.svg"
    alt="mongodb-file-export-solid"
    width={20}
    height={20}
    />
    import
    </Link>
    <Link href="/drop" className={styles.secondary}>
    <Image
    className={styles.logo}
    src="/trash-solid.svg"
    alt="mongodb-file-delete"
    width={20}
    height={20}
    />
    drop
    </Link>
    <Link href="/setting" className={styles.secondary}>
    <Image
    className={styles.logo}
    src="/gear-solid.svg"
    alt="gear-solid"
    width={20}
    height={20}
    />
    setting
    </Link>
    </div>
    </main>

    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">

    </footer>
    </div>
  );
}
