import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '更新賃料検討アプリ',
  description: '周辺募集から査定賃料を求め、双方が成立する賃料の幅を出す',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="app">
          <div className="inner">
            <h1><a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>更新賃料検討アプリ</a></h1>
            <span className="sub">v1.0 — 査定賃料に対する掛け目 r</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
