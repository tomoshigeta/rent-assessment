'use client'

import { FAIR_BAND_PCT, type RentRange } from '@/core'

const yen = (v: number) => `${Math.round(v).toLocaleString('ja-JP')}円`

/**
 * 掛け目 r の軸。双方が成立する範囲と「相場並み」の帯を1本の軸に重ねる。
 * 判定を4段階のラベルで出さないのは、同じ軸の別表現が2つ並ぶと矛盾して見えるため。
 */
export function RScale({ range, assessedRent, offerRent }: {
  range: RentRange
  assessedRent: number
  offerRent?: number
}) {
  // 軸の両端。範囲と相場並み帯と提示額がすべて収まるよう余白を取る。
  const marks = [range.rFloor, range.rCeiling, 0.975, 1.025, 1, ...(offerRent ? [offerRent / assessedRent] : [])]
  const lo = Math.min(...marks) - 0.04
  const hi = Math.max(...marks) + 0.04
  const pos = (r: number) => ((r - lo) / (hi - lo)) * 100

  const fairLo = 1 - FAIR_BAND_PCT / 100
  const fairHi = 1 + FAIR_BAND_PCT / 100
  const offerR = offerRent ? offerRent / assessedRent : null

  return (
    <div>
      <div style={{ position: 'relative', height: 78, marginTop: 26 }}>
        {/* 軸 */}
        <div style={{ position: 'absolute', top: 30, left: 0, right: 0, height: 1, background: 'var(--line)' }} />

        {!range.crossed && (
          <div title="双方が成立する範囲" style={{
            position: 'absolute', top: 22, height: 17, borderRadius: 3,
            left: `${pos(range.rFloor)}%`, width: `${pos(range.rCeiling) - pos(range.rFloor)}%`,
            background: '#dfeae4', border: '1px solid #9dbcae',
          }} />
        )}
        <div title={`相場並み（±${FAIR_BAND_PCT}%）`} style={{
          position: 'absolute', top: 26, height: 9, borderRadius: 2,
          left: `${pos(fairLo)}%`, width: `${pos(fairHi) - pos(fairLo)}%`,
          background: '#c6d8cc', border: '1px solid #7fa892',
        }} />

        {/* 査定賃料 r=1.0 */}
        <div style={{ position: 'absolute', top: 16, left: `${pos(1)}%`, transform: 'translateX(-50%)' }}>
          <div style={{ width: 1, height: 30, background: 'var(--ink)', margin: '0 auto' }} />
          <div style={{ fontSize: 11, whiteSpace: 'nowrap', marginTop: 2 }}>査定 {yen(assessedRent)}</div>
        </div>

        {/* 下限・上限 */}
        {([['下限', range.rFloor, range.floor], ['上限', range.rCeiling, range.ceiling]] as const).map(([label, r, v]) => (
          <div key={label} style={{ position: 'absolute', top: 0, left: `${pos(r)}%`, transform: 'translateX(-50%)' }}>
            <div style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{label} {r.toFixed(3)}</div>
            <div style={{ width: 1, height: 22, background: 'var(--muted)', margin: '0 auto' }} />
            <div style={{ fontSize: 11, whiteSpace: 'nowrap', marginTop: 12, color: 'var(--muted)' }}>{yen(v)}</div>
          </div>
        ))}

        {/* 提示額 */}
        {offerR !== null && (
          <div style={{ position: 'absolute', top: 44, left: `${pos(offerR)}%`, transform: 'translateX(-50%)' }}>
            <div style={{ width: 2, height: 16, background: 'var(--danger)', margin: '0 auto' }} />
            <div style={{ fontSize: 11, whiteSpace: 'nowrap', color: 'var(--danger)', fontWeight: 600 }}>
              提示 {offerR.toFixed(3)}
            </div>
          </div>
        )}
      </div>

      <div className="row-actions" style={{ marginTop: 30 }}>
        <span className="note"><span style={{ display: 'inline-block', width: 14, height: 9, background: '#dfeae4', border: '1px solid #9dbcae', verticalAlign: 'middle', marginRight: 4 }} />双方が成立する範囲</span>
        <span className="note"><span style={{ display: 'inline-block', width: 14, height: 9, background: '#c6d8cc', border: '1px solid #7fa892', verticalAlign: 'middle', marginRight: 4 }} />相場並み（±{FAIR_BAND_PCT}%）</span>
        <span className="note">r = 提示額 ÷ 査定賃料</span>
      </div>
    </div>
  )
}
