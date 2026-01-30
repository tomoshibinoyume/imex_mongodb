'use client';
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import styles from "../../page.module.css";

export default function SettingPage() {
  const { data: session, status } = useSession();
  const [totpSecret, setTotpSecret] = useState(null);
  const [totpVerify, setTotpVerify] = useState(false);
  const [totpDrop, setTotpDrop] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(true);
  const [addProjectArea, setAddProjectArea] = useState(false);
  const [projectUri, setProjectUri] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedAppName, setSelectedAppName] = useState('');
  const [inputDrop, setInputDrop] = useState(false);
  const [dropTargetApp, setDropTargetApp] = useState(null);
  const [dropText, setDropText] = useState('');
  const router = useRouter();

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
      // console.log('drop', data?.totpDrop);
      if(data?.totpDrop) {
        setIsLoading(false);
        return;
      }
      if(!data?.totpVerify){
        router.push("/");
        return;
      }
      // if (!data?.totpVerify) {
      //   router.push("/");
      //   return;
      // }
      setIsLoading(false);
    } catch (e) {
      console.log("TOTP info fetch error:", e);
      // console.log(totpDrop);
      setTotpSecret(false);
      setTotpVerify(false);
      router.push("/");
    }
  };

  const fetchUserProjects = async (id) => {
    console.log('fetchUserProjects');
    try {
      const res = await fetch(`/api/projects?userId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error('プロジェクトの取得に失敗しました');
      const data = await res.json();
      setProjects(data);
      console.log('projects', data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || !session?.user?.id || !session?.user?.email) {
      router.push("/");
      return;
    }
    fetchTotpVerify(session.user.id, session.user.email);
    fetchUserProjects(session.user.id);
  }, [session, status, router]);

  const handleSignOut = async () => {
    // console.log('handleSignOut');
    try{
      setSignOutLoading(true);
      await signOut('auth0');
    } catch (error) {
      setSignOutLoading(true);
      console.error('handleSignOut error:', error);
      alert('通信エラーが発生しました');
    } finally {
      setSignOutLoading(false);
    }
  }

  const handleAddProject = async () => {
    console.log('handleAddProject');
    setAddProjectArea(true);
  }

  const handleSubmitProject = async () => {
    console.log('handleSubmitProject');
    const id = session.user.id;
    const email = session.user.email;
    const project = projectUri;
    const url = new URL(projectUri);
    const appName = url.searchParams.get('appName');
    try {
      const res = await fetch("/api/projects/add_project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, email, project, appName }),
      });
      if (res.status === 409) {
        const data = await res.json();
        alert(data.message); // "すでに登録されています"
      } else if (!res.ok) {
        alert("保存に失敗しました");
      } else {
        alert("保存に成功しました");
      }
    } catch (e) {
      console.error(e);
      alert("ネットワークエラー");
    }
    setProjectUri('');
    setAddProjectArea(false);
    fetchUserProjects(session.user.id);
  }

  // ★ 修正：選択行だけ_drop入力欄を表示する
  const handleInputWordDrop = () => {
    if (!selectedAppName) return;
    setDropTargetApp(selectedAppName); // ← 選択した行にだけ_drop欄を表示
  };

  const handleConnectCluster = async () => {
    console.log('handleConnectCluster');
    setInputDrop(false);
    if (!selectedAppName || !session?.user?.id) return;
    try {
      const res = await fetch('/api/projects/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: session.user.id,
          appName: selectedAppName
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "接続に失敗しました");
        return;
      }

      // 接続成功したら画面遷移や表示変更など
      fetchUserProjects(session.user.id);
      alert('「' + selectedAppName + '」の接続に成功しました');
      setDropTargetApp(null);
      console.log('接続結果:', data);

      // 例: router.push("/dashboard")
    } catch (e) {
      console.error("接続エラー", e);
      setDropTargetApp(null);
      alert("接続中にエラーが発生しました");
    }
  };

  const handleDisconnectCluster = async () => {
    console.log('handleDisconnectCluster');

    if (!session?.user?.id) return;

    // 現在接続中のプロジェクトを探す
    const connectedProject = projects.find((p) => p.isConnected);

    if (!connectedProject) {
      alert("接続中のプロジェクトが見つかりませんでした");
      return;
    }

    const confirm = window.confirm(`「${connectedProject.appName}」の接続を解除しますか？`);
    if (!confirm) return;

    try {
      const res = await fetch('/api/projects/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: session.user.id,
          appName: connectedProject.appName
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "接続解除に失敗しました");
        return;
      }
      alert("接続を解除しました");
      setSelectedAppName(''); // ラジオボタン選択解除（任意）
      setDropTargetApp(null);
      fetchUserProjects(session.user.id); // 再取得
    } catch (err) {
      setDropTargetApp(null);
      console.error("接続解除エラー:", err);
      alert("接続解除中にエラーが発生しました");
    }
  };


  // const handleDropProject = async () => {
  //   if (dropText !== '_drop') {
  //     alert('「_drop」と入力してください');
  //     return;
  //   }
  //   if (!selectedAppName || !session?.user?.id) return;
  //   setInputDrop(true);
  //   try {
  //     const res = await fetch('/api/projects/drop', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({
  //         userId: session.user.id,
  //         appName: selectedAppName
  //       })
  //     });
  //
  //     const data = await res.json();
  //
  //     if (!res.ok) {
  //       alert(data.message || "削除に失敗しました");
  //       return;
  //     }
  //
  //     alert("削除しました");
  //     setDropText('');
  //     setDropTargetApp(null);
  //     fetchUserProjects(session.user.id);
  //   } catch (err) {
  //     console.error("削除エラー", err);
  //     setDropText('');
  //     setDropTargetApp(null);
  //     fetchUserProjects(session.user.id);
  //     alert("削除中にエラーが発生しました");
  //   }
  // };


  if(addProjectArea){
    return (
      <div className="grid items-center justify-items-center min-h-screen px-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center items-start">
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

      <div className={`${styles.ctas} w-full m-auto`}>
        <p className="w-full text-sm text-center">
          追加したいプロジェクトを入力して下さい。<br />ユーザー情報とパスワードは暗号化されます。
        </p>
      </div>

      <textarea
        className="w-full h-25 text-left text-start"
        value={projectUri}
        onChange={(e) => setProjectUri(e.target.value)}
      ></textarea>

      <div className={`${styles.ctas} w-full m-auto text-center`}>
      <button className="w-1/2 text-sm mt-7 m-auto" disabled={!projectUri} onClick={handleSubmitProject}>送信</button>
      </div>

      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">

      </footer>
      </div>
    );
  }

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
    ) : (
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
      <Link href="/setting/projects" className={styles.secondary}>
      <Image
      className={styles.logo}
      src="/plus-solid.svg"
      alt="plus-solid"
      width={15}
      height={15}
      />
      <span className="text-sm" onClick={handleAddProject}>プロジェクト</span>
      </Link>
      </div>

      <div className="p-4 space-y-4 m-auto text-center">
      <p className="font-semibold mb-2">登録プロジェクト一覧</p>
      {inputDrop && (
        <p>削除するには「_drop」を入力して下さい。</p>
      )}

      {projects.length > 0 ? (
        projects.map((project) => (
          <p key={project.appName}
             className={selectedAppName === project.appName ? 'bg-gray-200 text-black rounded p-2' : 'p-2'}>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="project"
                value={project.appName}
                checked={selectedAppName === project.appName}
                onChange={() => setSelectedAppName(project.appName)}
                className="accent-blue-600"
              />

              <span>
                {project.appName}
                {project.isConnected && (
                  <strong className="ml-1 text-xs text-green-600">（接続中）</strong>
                )}
              </span>
            </label>

            {/* ▼ 改行して下に_drop入力を表示 */}
            {dropTargetApp === project.appName && (
              <div className="mt-2">
                <input
                  type="text"
                  value={dropText}
                  onChange={(e) => setDropText(e.target.value)}
                  placeholder="_drop を入力"
                  className="border p-1 w-full"
                />
              </div>
            )}
          </p>
        ))
      ) : (
        <p className="text-xs">プロジェクトが見つかりません。</p>
      )}

      <button className="w-full mt-5" disabled={!selectedAppName} onClick={handleConnectCluster}>
      <div>接続</div>
      </button>
      <button
        className="w-full"
        onClick={handleDisconnectCluster}
        disabled={
          !selectedAppName ||
          !projects.find((p) => p.appName === selectedAppName)?.isConnected
        }
      >
        <div>解除</div>
      </button>


      </div>

      </>
    )}
    </main>

    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
    This is projects page.
    </footer>
    </div>
  );
}
