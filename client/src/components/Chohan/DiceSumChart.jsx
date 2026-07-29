import React from 'react'

/**
 * Line chart lịch sử tổng 2 xúc xắc — tự vẽ bằng SVG, không thêm thư viện.
 * Trục X: các vòng gần nhất (tối đa 20, cũ → mới). Trục Y: tổng 2 xúc xắc 2–12.
 * Điểm tô màu theo kết quả: xanh = Chẵn, đỏ = Lẻ.
 */
const MIN_Y = 2
const MAX_Y = 12

const DiceSumChart = ({ history = [] }) => {
  // history là mới→cũ; đảo lại để trục X đi từ cũ sang mới
  const data = [...history].reverse().slice(-20)

  if (data.length < 2) {
    return (
      <div className="sp-muted" style={{ fontSize: 12, padding: '4px 0' }}>
        Cần thêm vài vòng nữa để vẽ biểu đồ.
      </div>
    )
  }

  const W = 320
  const H = 148
  const padL = 20
  const padR = 8
  const padT = 8
  const padB = 18
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const xAt = (i) => padL + (i / (data.length - 1)) * innerW
  const yAt = (sum) => padT + ((MAX_Y - sum) / (MAX_Y - MIN_Y)) * innerH

  const points = data.map((d, i) => ({
    x: xAt(i),
    y: yAt(d.die1 + d.die2),
    sum: d.die1 + d.die2,
    result: d.result,
    roundNumber: d.roundNumber,
  }))

  const linePath = points
    .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const yTicks = [2, 4, 6, 8, 10, 12]
  // Nhãn X: vòng đầu, giữa, cuối để đỡ rối
  const xLabelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chohan-chart" role="img" aria-label="Biểu đồ tổng xúc xắc">
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yAt(t)}
            y2={yAt(t)}
            className="chohan-chart__grid"
          />
          <text x={padL - 4} y={yAt(t) + 3} textAnchor="end" className="chohan-chart__ytext">
            {t}
          </text>
        </g>
      ))}

      <path d={linePath} className="chohan-chart__line" />

      {points.map((p) => (
        <circle
          key={p.roundNumber}
          cx={p.x}
          cy={p.y}
          r={3.2}
          className={`chohan-chart__dot chohan-chart__dot--${p.result}`}
        >
          <title>{`Vòng ${p.roundNumber}: tổng ${p.sum} (${p.result === 'cho' ? 'Chẵn' : 'Lẻ'})`}</title>
        </circle>
      ))}

      {xLabelIdx.map((i) => (
        <text
          key={i}
          x={points[i].x}
          y={H - 5}
          textAnchor="middle"
          className="chohan-chart__xtext"
        >
          #{points[i].roundNumber}
        </text>
      ))}
    </svg>
  )
}

export default DiceSumChart
