'use client';
import Image from "next/image";
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from "next-auth/react"
import { authOptions } from "@/lib/authOptions";
import { useRouter, useSearchParams } from 'next/navigation';
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
  const [selectedCol, setSelectedCol] = useState('');
  const [inputColName, setInputColName] = useState('');
  const [colLength, setColLength] = useState(0);
  const [exportData, setExportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [tapAllItems, setTapAllItems] = useState(false);
  const isCancelledRef = useRef(false);
  const [docSize, setDocSize] = useState('');
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
      return data;
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
  }, [session, status, router, skip]);


  const handleDbChange = async (e) => {
    // console.log('hendleDbChange');
    const dbName = e.target.value;
    setSelectedDb(dbName); // ← これが抜けてた
    setInputColName('');
    setCollections([]);
    setExportData([]);
    setIsColLoading(true);
    setIsLoading(false);
    setColLength(0);
    setSkip(0);
    skipRef.current = 0;
    setHasMore(true);
    setInputDbName(dbName);
    setTapAllItems(false);
    try{
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
      setIsColLoading(true);
    } catch (error){
      setIsColLoading(true);
      console.error('hendleDbChange failed:', error);
    } finally {
      setIsColLoading(false);
    }
  }

  const handleColChange = async (e, length, doc_size) => {
    // console.log('handleColChange');
    // console.log(length);
    const colName = e.target.value;
    setInputColName("");
    setSelectedCol(colName); // ← これも追加推奨
    setExportData([]);
    setInputColName(colName);
    setColLength(length);
    setSkip(0);
    skipRef.current = 0;
    setHasMore(true);
    setIsLoading(false);
    setTapAllItems(false);
    setDocSize(doc_size);
    // console.log(colName, doc_size);
  }

  const targetRef = useRef(null);
  const skipRef = useRef(0);
  const timeoutRef = useRef(null); // ← タイマーID保持用

  const handleAllExport = async () => {
    // console.log('handleAllExport');
    setTapAllItems(true);
    setIsLoading(true);
    isCancelledRef.current = false; // ← 追加：開始時にフラグをリセット
    if (!hasMore) return;
    try {
      const res = await fetch(`/api/export?db=${inputDbName}&col=${inputColName}&skip=${skipRef.current}&limit=100&projectUri=${encodeURIComponent(projectUri)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setExportData(prev => {
          const existingIds = new Set(prev.map(post => post._id));
          const filteredNewPosts = data.filter(post => !existingIds.has(post._id));
          const updated = [...prev, ...filteredNewPosts];
          if (updated.length >= colLength) {
            setHasMore(false);
            clearTimeout(timeoutRef.current);
            setTapAllItems(false); // ✅ 全件読み込み完了 → falseに戻す
          }
          return updated;
        });
        // setSkip(prev => prev + data.length);
        skipRef.current += data.length;
        if (data.length < 100) { // limitより少なかったらもうデータない
          setHasMore(false);
          setTapAllItems(false);
        }
      } else {
        console.error('APIの戻り値が配列じゃない:', data);
        setHasMore(false);
      }
    } catch (error) {
      console.error('データロード失敗:', error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      if (hasMore && !isCancelledRef.current) {
        timeoutRef.current = setTimeout(() => {
          handleAllExport();
        }, docSize < 5000 ? 1500 : 5000);
      }
      // if (hasMore && docSize < 5000) {
      //   timeoutRef.current = setTimeout(() => {
      //     handleAllExport();  // 再帰呼び出し
      //   }, 1500);
      // }
      // if (hasMore && docSize > 5000) {
      //   timeoutRef.current = setTimeout(() => {
      //     handleAllExport();  // 再帰呼び出し
      //   }, 6000);
      // }
    }
  }

  // JSONファイルとしてダウンロード
  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inputDbName}_${inputColName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJsonAsCsv = (jsonArray) => {
    if (!jsonArray || jsonArray.length === 0) {
      alert("データがありません。");
      return;
    }
    // ヘッダーを取得
    const headers = Object.keys(jsonArray[0]);
    // CSV文字列を作成
    const csvRows = [
      headers.join(","), // ヘッダー行
      ...jsonArray.map(row => headers.map(field => JSON.stringify(row[field] ?? "")).join(","))
    ];
    const csvString = csvRows.join("\n");
    // Blobを作成してダウンロード
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", inputColName + '_' + inputDbName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        { collections.length > 0 ? (
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
      {tapAllItems ? (
        <button className="w-full"
        disabled={exportData.length == 0 || exportData.length == colLength || !tapAllItems}
        onClick={() => {clearTimeout(timeoutRef.current);setTapAllItems(false);isCancelledRef.current = true;}}>
        <div>読み込み停止<span className="text-xs">（{exportData.length}/{colLength}件）</span></div>
        </button>
      ) : (
        <button className="w-full" disabled={!inputColName || isLoading || tapAllItems || exportData.length == colLength} onClick={handleAllExport}>
        <div>表示する（100件）</div>
        </button>
      )}
      </div>
      <div className="flex-grow flex gap-4 w-full px-3">
      <div className="m-auto">
      {exportData.length > 0 && colLength !== exportData.length && docSize < 5000 && (
        <p>あと{Math.ceil(((colLength - exportData.length) / 100) * 2 / 60)}分</p>
      )}
      {exportData.length > 0 && colLength !== exportData.length && docSize > 5000 && (
        <p className="text-center text-xs">
        あと{Math.ceil(((colLength - exportData.length) / 100) * 5 / 60)}分ほど<br />
        1件あたり「{(docSize/1000).toFixed(2)}kb」と<br />かなり多いので時間がかかります。
        </p>
      )}
      </div>
      </div>
      <div className="flex-grow flex gap-4 w-full px-3">
      <div className="w-1/2">
      <button className="w-full" disabled={exportData.length == 0 || tapAllItems} onClick={handleDownloadJSON}>json</button>
      </div>
      <div className="w-1/2">
      <button className="w-full" disabled={exportData.length == 0 || tapAllItems} onClick={() => downloadJsonAsCsv(exportData)}>csv</button>
      </div>
      </div>
      <div className="m-auto">
      {inputColName && (
        <div className="w-[375px]">
        <p className="text-center">file name is<br />&quot;{inputColName}_{inputDbName}.json&quot;.</p>
        </div>
      )}
      <input type="hidden" name="title" value={inputDbName} onChange={(e) => setInputDbName(e.target.value)} placeholder="データベース名" readOnly />
      {inputColName && (
        <input type="hidden" name="text" value={inputColName} onChange={(e) => setInputColName(e.target.value)}　placeholder="コレクション名" readOnly />
      )}
      </div>
      <div ref={targetRef} className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
      {exportData.length > 0 && (
        <div className="w-[320] whitespace-pre-wrap overflow-x-auto">
        <p className="text-center text-xs">表示件数</p>
        <p className="text-center">{exportData.length}/{colLength}件</p>
        {exportData.map(json => (
          <pre key={json._id.toString()} className="text-sm">
          {JSON.stringify(json, null, 2)}
          </pre>
        ))}
        </div>
      )}
      </div>
      <div className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center m-auto">
      {loading && <p className="text-center mt-4">Loading...</p>}
      {!hasMore && exportData.length !== 0 && <p className="text-center mt-4 text-gray-500">No more collection</p>}
      </div>
      </>
    )}

    </main>
    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
    <div className={`${styles.ctas} m-auto`}>
    {status === 'loading' || isLoading ? '' : 'This is export page.'}
    </div>
    </footer>
    </div>
  )
}
