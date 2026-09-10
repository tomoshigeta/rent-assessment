import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '更新賃料検討アプリ',
  description: '周辺募集との比較と、更新・転居の費用差を確認する',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="app">
          <div className="inner">
            <h1><a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>更新賃料検討アプリ</a></h1>
            <span className="sub">v0.1 — 居住用・税込実額</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
