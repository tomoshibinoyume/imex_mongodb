'use client'; // これが必要
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from 'next-auth/react';

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon.png" />
    <meta name="theme-color" content="#b8e986" />
    <body>
    <SessionProvider>{children}</SessionProvider>
    </body>
    </html>
  );
}
