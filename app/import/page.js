'use client';
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from "next-auth/react"
import { authOptions } from "@/lib/authOptions";
import { useRouter } from 'next/navigation';
import styles from "../page.module.css";
import Papa from 'papaparse';
import jschardet from 'jschardet';
import Encoding from 'encoding-japanese';

export default function ImportPage() {
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
  const [exportData, setExportData] = useState([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [content, setContent] = useState('');
  const [docSize, setDocSize] = useState('');
  const isDisabled = !(inputDbName.trim() && inputColName.trim() && content.trim());
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [importProgress, setImportProgress] = useState('');
  const [importTotal, setImportTotal] = useState('');
  const [connectedProjects, setConnectedProjects] = useState([]);
  const [projectUri, setProjectUri] = useState('');
  const importAbortRef = useRef(false);


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

  const fetchCollectionsForCurrentDb = async () => {
    try {
      const projects = await fetchConnectedProjects(session.user.id);
      if (!projects || projects.length === 0) return;
      const encryptedUri = projects[0].projectUri;
      const res = await fetch('/api/collections', {
        method: 'POST',
        body: JSON.stringify({ dbName: inputDbName, encryptedUri }),
        headers: { 'Content-Type': 'application/json' },
      });
      const text = await res.text();
      const data = JSON.parse(text);
      setCollections(data.colArray || []);
    } catch (error) {
      console.error("fetchCollectionsForCurrentDb error:", error);
      setCollections([]);
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
    // console.log('hendleDbChange');
    const value = e.target.value;
    const dbName = String(value).trim();
    setSelectedDb(dbName);
    setSelectedCol('');
    setInputColName('');
    setCollections([]);
    setExportData([]);
    setColLength("");
    setInputDbName(dbName);
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
      // console.log(data.colArray);
      setCollections(data.colArray || []);
    } catch (error){
      setCollections([]);  // エラー時にコレクションを空に設定
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
    setColLength("");
    // console.log(colName, doc_size);
  }


  const handleFileChange = async (e) => {
    setFileLoading(true);
    setColLength('');
    setContent('');
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const buffer = new Uint8Array(e.target.result);
        const headText = String.fromCharCode(...buffer.slice(0, 1024));
        const detected = jschardet.detect(headText);
        const encoding = (detected.confidence > 0.9 && detected.encoding)
          ? detected.encoding.toLowerCase()
          : 'utf-8';

        const unicodeString = Encoding.convert(buffer, {
          to: 'UNICODE',
          from: encoding,
          type: 'string',
        });

        if (file.name.endsWith('.json')) {
          const json = JSON.parse(unicodeString);
          setColLength(json.length);
          setContent(JSON.stringify(json, null, 2));
          const jsonStr = JSON.stringify(json);
          setDocSize(new TextEncoder().encode(jsonStr).length);
        } else {
          setContent('ファイルを読み込めませんでした。\n拡張子を確認して下さい。');
          setColLength('');
        }
      } catch (err) {
        console.error(err);
        setContent('ファイルを読み込めませんでした。');
      } finally {
        setFileLoading(false);
      }
    };

    reader.onerror = function () {
      setContent('ファイルを読み込めませんでした。');
      setFileLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };


  const handleImport = async () => {
    setImportLoading(true);
    importAbortRef.current = false; // ← 開始時にリセット
    try {
      const projects = await fetchConnectedProjects(session.user.id);
      if (!projects || projects.length === 0) return;
      const encryptedUri = projects[0].projectUri;
      const parsed = JSON.parse(content);
      const chunkSize = 100;
      const dbName = String(inputDbName).trim();
      const colName = String(inputColName).trim();
      const chunks = [];
      for (let i = 0; i < parsed.length; i += chunkSize) {
        chunks.push(parsed.slice(i, i + chunkSize));
      }

      let totalInserted = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (importAbortRef.current) {
          alert('インポートが中止されました。');
          break;
        }

        const res = await fetch('/api/import', {
          method: 'POST',
          body: JSON.stringify({
            encryptedUri,
            dbName,
            colName,
            docs: chunks[i],
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`チャンク${i + 1}のインポート失敗: ${res.status} ${errorText}`);
        }

        const result = await res.json();
        totalInserted += result.insertedCount || 0;
        setImportProgress(totalInserted);
        setImportTotal(chunks.length);
      }

      if (!importAbortRef.current) {
        alert(`${totalInserted} 件のドキュメントをインポートしました`);
        setColLength('');
        setContent('');
        setInputDbName('');
        setInputColName('');
      }

      // インポート後の処理（省略）
      fetchDatabase(projectUri); // データベース更新
      fetchCollectionsForCurrentDb(); // コレクション更新（下に詳細）
    } catch (err) {
      alert('インポート処理でエラーが発生しました。');
      console.error('Import Error:', err);
      setContent(err.message);
    } finally {
      importAbortRef.current = false; // ← 必ずリセット
      setIsColLoading(false);
      setImportLoading(false);
    }
  };



  if (status === "loading" || isLoading) {
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
      <div className="w-1/2 databases">
      <p>データベース</p>
      <input type="text" name="title" value={inputDbName} className="w-full" onChange={(e) => setInputDbName(e.target.value)} placeholder="データベース名" />
      </div>
      <div className="w-1/2 collections">
      <p>コレクション</p>
      <input type="text" name="text" value={inputColName} className="w-full" onChange={(e) => setInputColName(e.target.value)} placeholder="コレクション名" />
      </div>
      </div>

      <div className="flex-grow flex gap-4 w-full px-3">
      <div className="w-1/2">
      <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
      {projectUri ? (
        <span className="text-white input_file w-full text-center">
        {fileLoading ? '読み込み中' : 'ファイルを選択'}
        </span>
      ) : (
        <button className="text-white w-full" disabled>
        ファイルを選択
        </button>
      )}
      <input
      key={fileInputKey}
      type="file"
      disabled={fileLoading || !projectUri}
      className="hidden"
      accept=".json"
      onChange={(e) => {
        handleFileChange(e);
        setFileInputKey(Date.now()); // ← input を完全リセット
      }}
      />
      </label>
      </div>

      <div className="w-1/2">
      <button
        className="w-full text-white py-2 px-4 rounded"
        disabled={!importLoading && isDisabled}
        onClick={() => {
          if (importLoading) {
            importAbortRef.current = true;
            setImportLoading(false);
            fetchDatabase(projectUri); // データベース更新
            fetchCollectionsForCurrentDb(); // コレクション更新（下に詳細）
          } else {
            handleImport();
          }
        }}
      >
        {importLoading ? 'インポート中止' : 'インポート'}
      </button>
      </div>
      </div>
      {!content && (
        <p className="text-center m-auto">
        <span className="text-xs">対応ファイル：JSONのみ</span><br />
        <span className="text-xs">文字コード対応：UTF-8 / Shift_JIS</span>
        </p>
      )}

      {content && Number(colLength || 0) > 0 && (
        <div className="text-center m-auto w-full">
        <p className="mb-3">
        <span className="text-xs">インポート中止後は、再開できません。<br />再度実行すると最初からやり直しになります。</span>
        </p>
        <p>
        {importProgress && (
          <span>{importProgress} / </span>
        )}
        <span>{colLength}件 / {(docSize / 1024 / 1024).toFixed(2)}MB</span><br />
        </p>
        </div>
      )}

      {content && (
        <>
        <button className="m-auto" disabled={importLoading} onClick={() => setContent('')}>×</button>
        </>
      )}

      <div className="w-[320] whitespace-pre-wrap overflow-x-auto m-auto">
      <pre className="text-xs">{content}</pre>
      </div>
      </>
    )}

    </main>
    <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
    <div className={`${styles.ctas} m-auto`}>
    {status === 'loading' || isLoading ? '' : 'This is import page.'}
    </div>
    </footer>
    </div>
  )
}
