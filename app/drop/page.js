'use client';
import Image from "next/image";
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from "next-auth/react"
import { authOptions } from "@/lib/authOptions";
import { useRouter } from 'next/navigation';
//
import Papa from 'papaparse';
import jschardet from 'jschardet';
import Encoding from 'encoding-japanese';
import styles from "../page.module.css";

export default function ExportPage() {
  const { data: session, status } = useSession()
  const [totpSecret, setTotpSecret] = useState(null);
  const [totpVerify, setTotpVerify] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  //
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [inputDbName, setInputDbName] = useState('');
  const [isColLoading, setIsColLoading] = useState(false);
  const [collections, setCollections] = useState([]);
  const [selectedCol, setSelectedCol] = useState([]);
  const [inputColName, setInputColName] = useState('');
  const [colLength, setColLength] = useState(0);
  const [loading, setLoading] = useState(false);
  const [docSize, setDocSize] = useState('');
  const [dropDbLoading, setDropDbLoading] = useState(false);
  const [dropColLoading, setDropColLoading] = useState(false);
  const [connectedProjects, setConnectedProjects] = useState([]);
  const [projectUri, setProjectUri] = useState('');

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
      setTotpSecret(data?.totpSecret ?? false);
      setTotpVerify(data?.totpVerify ?? false);
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
      console.log("TOTP info fetch error:", e);
      setTotpSecret(false);
      setTotpVerify(false);
      router.push("/");
    }
  };

  const fetchDatabase = async (projectUri) => {
    try {
      const res = await fetch(`/api/databases?projectUri=${encodeURIComponent(projectUri)}`);
      const data = await res.json();
      // console.log(data);
      if (Array.isArray(data)) {
        setDatabases(data);
      } else {
        console.error('Invalid database list', data);
        setDatabases([]);
      }
      setIsColLoading(true);
    } catch (error) {
      console.error('Failed to fetch databases:', error);
      setIsColLoading(true);
      setDatabases([]);
    } finally {
      setIsDbLoading(false);
    }
  };

  const fetchConnectedProjects = async (id) => {
    try {
      const res = await fetch(`/api/projects/is-connected?userId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("接続中のプロジェクト取得に失敗しました");
      const data = await res.json();
      setConnectedProjects(data);
      setIsConnecting(true);
      if(!data.length){
        setIsDbLoading(true);
        setIsColLoading(true);
      }
      return data;  // ここで返す
    } catch (err) {
      console.error("fetchConnectedProjects error:", err);
      setConnectedProjects([]);
      return null;
    }
  };


  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || !session?.user?.id || !session?.user?.email) {
      router.push("/");
      return;
    }
    const init = async () => {
      await fetchTotpVerify(session.user.id, session.user.email);
      const projects = await fetchConnectedProjects(session.user.id);
      if (!projects || projects.length === 0) return;
      setProjectUri(projects[0].projectUri); // ← 追加
      await fetchDatabase(projects[0].projectUri);
    };
    init();
  }, [session, status, router]);


  const handleDbChange = async (e) => {
    const dbName = e.target.value;
    setSelectedDb(dbName);
    setInputColName('');
    setCollections([]);
    setColLength(0);
    setInputDbName(dbName);
    try {
      const projects = await fetchConnectedProjects(session.user.id);
      if (!projects || projects.length === 0) return;
      const encryptedUri = projects[0].projectUri;

      const res = await fetch('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ dbName, encryptedUri }),
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      if (!text) {
        console.warn("collections API のレスポンスが空です");
        setCollections([]);
        return;
      }
      const data = JSON.parse(text);
      setCollections(data.colArray || []);
    } catch (error) {
      console.error('handleDbChange failed:', error);
      setCollections([]);  // エラー時にコレクションを空に設定
      setIsColLoading(true);
    } finally {
      setIsColLoading(false);
    }
  };



  const handleColChange = async (e, length, doc_size) => {
    // console.log('handleColChange');
    // console.log(length);
    const colName = e.target.value;
    setInputColName("");
    setSelectedCol(colName); // ← これも追加推奨
    setInputColName(colName);
    setColLength(length);
    setIsLoading(false);
    setDocSize(doc_size);
    // console.log(colName, doc_size);
  }

  const handleDropDatabase = async () => {
    const actualDbName = inputDbName.replace(/_drop$/, '');
    setDropDbLoading(true);
    try {
      const projects = await fetchConnectedProjects(session.user.id);
      if (!projects || projects.length === 0) return;
      const res = await fetch('/api/drop', {
        method: 'POST',
        body: JSON.stringify({ dbName: actualDbName, encryptedUri: projects[0].projectUri }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('データベース削除失敗:', data.error || '不明なエラー');
      } else {
        console.log('削除成功:', data.message);
        setDatabases(prev => prev.filter(db => db !== actualDbName));
        setCollections([]);
        setInputDbName('');
        setInputColName('');
        setIsColLoading(true);
      }
    } catch (error) {
      console.error('削除リクエスト失敗:', error);
      setIsColLoading(true);
    } finally {
      setDropDbLoading(false);
    }
  };

  const handleDropCollection = async () => {
    setDropColLoading(true);
    const realDbName = inputDbName.replace(/_drop$/, ''); // ← 実DB名に変換
    const projects = await fetchConnectedProjects(session.user.id);
    if (!projects || projects.length === 0) return;
    const encryptedUri = projects[0].projectUri;
    try {
      const res = await fetch('/api/drop', {
        method: 'POST',
        body: JSON.stringify({
          dbName: realDbName,
          colName: inputColName,
          encryptedUri
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('コレクション削除失敗:', data.error || '不明なエラー');
      } else {
        console.log('削除成功:', data.message);
        setInputDbName(realDbName);
        setInputColName('');
        setSelectedDb(realDbName);
        // 削除後の最新コレクション一覧を取得
        const updatedCollections = await fetchCollections(inputDbName);
        setCollections(updatedCollections);
        console.log(collections);
      }
    } catch (error) {
      console.error('削除リクエスト失敗:', error);
    } finally {
      setDropColLoading(false);
      fetchDatabase(projects[0].projectUri);
    }
  };

  const fetchCollections = async (dbName) => {
    setIsColLoading(true); // ローディング開始
    try {
      const projects = await fetchConnectedProjects(session.user.id);
      if (!projects || projects.length === 0) return [];

      const encryptedUri = projects[0].projectUri;
      const res = await fetch('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ dbName, encryptedUri }),
        headers: { 'Content-Type': 'application/json' },
      });

      const text = await res.text();
      if (!text) {
        console.warn("collections API のレスポンスが空です");
        return [];
      }

      const data = JSON.parse(text);
      return data.colArray || [];
    } catch (error) {
      console.error('コレクション取得失敗:', error);
      return [];
    } finally {
      setIsColLoading(false); // ローディング終了は必ずここで！
    }
  };



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


  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen py-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
    <main className="flex flex-col gap-[32px] w-full row-start-2 items-center sm:items-start">
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

    {status === 'authenticated' && (
      <>
      {connectedProjects.length > 0 ? (
        connectedProjects.map(p => (
          <p key={p.appName} className="rounded m-auto">
          ✅ 接続中：{p.appName}
          </p>
        ))
      ) : (
        !isConnecting ? (
          <p className="text-sm text-gray-500 m-auto">接続を確認しています。</p>
        ) : (
        <p className="text-sm text-gray-500 m-auto">現在接続中のプロジェクトはありません。</p>
        )
      )}
      <div className="flex-grow flex gap-4 w-full px-3">
      <div className="w-1/2 databases break-words">
      <p>データベース</p>
      {databases.length > 0 ? (
        databases.map(db => (
          <p key={db} className={inputDbName === db ? 'bg-gray-600' : ''}>
          <label>
          <input type="radio" name="databasename" id={`db-${db}`} value={db} checked={selectedDb === db} onChange={handleDbChange} />
          {db}
          </label>
          </p>
        ))
      ) : (
        !isDbLoading ? (
          <div className="p-5">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></div>
          </div>
        ) : (
          !connectedProjects ? (
            <p className="text-xs mt-2">データベースがありません。</p>
          ) : (
            <p className="text-xs mt-2">プロジェクトが接続されていません。</p>
          )
        )
      )}

      </div>
      <div className="w-1/2 collections break-words">
        <p>コレクション</p>
        {collections.length > 0 ? (
          collections.map(col => (
            <div key={col.name} className={inputColName === col.name ? 'bg-gray-600' : ''}>
            <label>
            <input
            type="radio"
            name="collectionname"
            value={col.name}
            checked={selectedCol === col.name}
            onChange={(e) => handleColChange(e, col.count, col.sampleDocSize)}
            />
            {col.name}
            <div className="text-xs col_details text-right">
            {(col.sampleDocSize / 1000).toFixed(2)} kb / 1件<br />
            {(col.size / 1024 / 1024).toFixed(2)} MB / {col.count} 件
            </div>
            </label>
            </div>
          ))
        ) : (
          !isColLoading ? (
            <div className="p-5">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mx-auto"></div>
            </div>
          ) : !connectedProjects || connectedProjects.length === 0 ? (
            <p className="text-xs mt-2">プロジェクトが接続されていません。</p>
          ) : !inputDbName ? (
            <p className="text-xs mt-2">データベースを選択して下さい。</p>
          ) : !collections ? (
            <p className="text-xs mt-2">コレクションがありません。</p>
          ) : (
            <div className="p-5">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500 mx-auto"></div>
            </div>
          )
        )}
      </div>
      </div>

      <div className="flex-grow flex gap-4 w-full px-3">
      <div className="w-1/2 databases">
      <p>データベース</p>
      <input type="text" name="title" value={inputDbName} disabled={!connectedProjects} className="w-full" onChange={(e) => setInputDbName(e.target.value)} placeholder="データベース名" />
      </div>
      <div className="w-1/2 collections">
      <p>コレクション</p>
      <input type="text" name="text" value={inputColName} disabled={!connectedProjects} className="w-full" onChange={(e) => setInputColName(e.target.value)} placeholder="コレクション名" />
      </div>
      </div>


      <p className="text-xs text-gray-400 m-auto">※ 削除には末尾に「_drop」を付けてください</p>

      <div className="flex-grow flex gap-4 w-full px-3">
      <div className="w-1/2">
      <button
        className="w-full"
        disabled={
          dropDbLoading ||
          !inputDbName.endsWith('_drop') ||
          !databases.includes(inputDbName.replace(/_drop$/, ''))
        }
        onClick={handleDropDatabase}
      >
        {dropDbLoading ? '削除中' : 'データベース削除'}
      </button>
      </div>
      <div className="w-1/2">
      <button
        className="w-full"
        disabled={
          dropColLoading ||
          !inputColName ||
          !inputColName.endsWith('_drop') ||
          !databases.includes(inputDbName.replace(/_drop$/, ''))
        }
        onClick={handleDropCollection}
      >
        {dropColLoading ? '削除中' : 'コレクション削除'}
      </button>
      </div>
      </div>
      </>
    )}


    </main>
    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
    <div className={`${styles.ctas} m-auto`}>
    {status === 'loading' || isLoading ? '' : 'This is drop page.'}
    </div>
    </footer>
    </div>
  )
}
