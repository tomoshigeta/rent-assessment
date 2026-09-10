'use client'

import type { ScenarioResult } from '@/core'

const SERIES_COLORS = ['#1f5f4e', '#8a5a12', '#3a5a8a', '#7a3a6a', '#5a6a2a', '#8a3a2a']

/**
 * 累計費用の推移。仕様書 §5「累計費用のグラフと月別明細を表示し」。
 * 依存を増やさずインラインSVGで描く。
 */
export function CostChart({ series, horizon, searchHorizon }: {
  series: { label: string; result: ScenarioResult }[]
  horizon: number
  searchHorizon: number
}) {
  if (series.length === 0) return null

  const W = 720, H = 260
  const pad = { top: 12, right: 12, bottom: 26, left: 62 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const maxY = Math.max(...series.map((s) => s.result.cumulativeAt(searchHorizon)), 1)
  const x = (m: number) => pad.left + (m / searchHorizon) * innerW
  const y = (v: number) => pad.top + innerH - (v / maxY) * innerH

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxY / ticks) * i)
  const xStep = searchHorizon <= 36 ? 6 : searchHorizon <= 72 ? 12 : 24
  const xTicks = Array.from({ length: Math.floor(searchHorizon / xStep) + 1 }, (_, i) => i * xStep)

  return (
    <div className="scroll-x">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: 'block' }} role="img"
        aria-label="累計費用の推移">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="#e6e4de" strokeWidth={1} />
            <text x={pad.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#6b6b66">
              {(v / 10000).toFixed(0)}万
            </text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize={10} fill="#6b6b66">{m}</text>
        ))}

        {/* 選択した比較期間 */}
        <line x1={x(horizon)} x2={x(horizon)} y1={pad.top} y2={pad.top + innerH} stroke="#9a2a24" strokeDasharray="3 3" strokeWidth={1} />
        <text x={x(horizon)} y={pad.top + 10} fontSize={10} fill="#9a2a24" textAnchor="middle">{horizon}ヶ月</text>

        {series.map((s, i) => {
          const pts = Array.from({ length: searchHorizon + 1 }, (_, m) => `${x(m)},${y(s.result.cumulativeAt(m))}`).join(' ')
          return <polyline key={s.label} points={pts} fill="none" stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={1.8} />
        })}
      </svg>
      <div className="row-actions" style={{ marginTop: 6 }}>
        {series.map((s, i) => (
          <span key={s.label} className="note" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2, background: SERIES_COLORS[i % SERIES_COLORS.length], display: 'inline-block' }} />
            {s.label}
          </span>
        ))}
        <span className="note">横軸: 経過月数 / 縦軸: 累計費用</span>
      </div>
    </div>
  )
}
