import React, { useMemo } from 'react'
import UserAvatar from '../Avatar/UserAvatar'
import {
  finishGateLayout,
  finishLinePolygon,
  isRedPhase,
  PHASE,
  projectPawn,
  trackPolygonPoints,
} from '../../utils/redLight'

const RedLightField = ({
  players = [],
  phase,
  holding,
  onHoldStart,
  onHoldEnd,
}) => {
  const phaseType = phase?.type || PHASE.GREEN
  const red = isRedPhase(phase) || phaseType === PHASE.TURNING_RED
  const dollFacing = red ? 'front' : 'away'
  const gate = useMemo(() => finishGateLayout(), [])
  const trackPoints = useMemo(() => trackPolygonPoints(), [])
  const finishPoints = useMemo(() => finishLinePolygon(), [])

  const actors = [...players]
    .map((player, index) => ({
      player,
      index,
      point: projectPawn(player.progress, player.lane ?? index, players.length),
    }))
    .sort((a, b) => a.point.y - b.point.y || a.index - b.index)

  return (
    <div
      className={`rl-field rl-field--${phaseType}`}
      onPointerDown={(event) => {
        event.preventDefault()
        onHoldStart?.()
      }}
      onPointerUp={onHoldEnd}
      onPointerLeave={onHoldEnd}
      onContextMenu={(event) => event.preventDefault()}
      role="application"
      aria-label="Sân Đèn xanh Đèn đỏ"
    >
      <div className="rl-sky">
        <span className="rl-cloud rl-cloud--a" />
        <span className="rl-cloud rl-cloud--b" />
        <span className="rl-sun" />
      </div>

      <div className={`rl-banner rl-banner--${phaseType}`}>
        {phaseType === PHASE.RED || phaseType === PHASE.TURNING_RED ? 'ĐÈN ĐỎ' : 'ĐÈN XANH'}
      </div>

      <div className="rl-stage">
        <svg className="rl-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="rl-lane-stripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(34)">
              <rect width="4" height="8" fill="#f4d27a" />
              <rect x="4" width="4" height="8" fill="#f7e7b0" />
            </pattern>
            <pattern id="rl-check" patternUnits="userSpaceOnUse" width="4" height="4">
              <rect width="2" height="2" fill="#1a1a1a" />
              <rect x="2" y="2" width="2" height="2" fill="#1a1a1a" />
              <rect x="2" width="2" height="2" fill="#f6f6f6" />
              <rect y="2" width="2" height="2" fill="#f6f6f6" />
            </pattern>
          </defs>
          <ellipse className="rl-map__grass" cx="50" cy="58" rx="46" ry="34" />
          <polygon className="rl-map__track" points={trackPoints} fill="url(#rl-lane-stripes)" />
          <polygon className="rl-map__track-edge" points={trackPoints} />
          <polygon className="rl-map__finish" points={finishPoints} fill="url(#rl-check)" />
        </svg>

        <div className="rl-actors">
          <div
            className={`rl-doll rl-doll--${dollFacing}`}
            aria-hidden="true"
            style={{ left: `${gate.doll.x}%`, top: `${gate.doll.y}%` }}
          >
            <div className="rl-doll__hair" />
            <div className="rl-doll__head">
              <i />
              <i />
            </div>
            <div className="rl-doll__dress" />
          </div>

          <div
            className={`rl-signal rl-signal--${phaseType}`}
            aria-hidden="true"
            style={{ left: `${gate.signal.x}%`, top: `${gate.signal.y}%` }}
          >
            <b />
            <b />
          </div>

          <div className="rl-gate" aria-hidden="true">
            <span
              className="rl-gate__beam"
              style={{
                left: `${gate.far.x}%`,
                top: `${gate.far.y}%`,
                width: `${gate.width}%`,
                transform: `translateY(-58px) rotate(${gate.angle}deg)`,
              }}
            />
            <span
              className="rl-gate__post rl-gate__post--far"
              style={{ left: `${gate.far.x}%`, top: `${gate.far.y}%` }}
            />
            <span
              className="rl-gate__banner"
              style={{ left: `${gate.mid.x}%`, top: `${gate.mid.y}%` }}
            >
              ĐÍCH
            </span>
            <span
              className="rl-gate__post rl-gate__post--near"
              style={{ left: `${gate.near.x}%`, top: `${gate.near.y}%` }}
            />
          </div>

          {actors.map(({ player, point }) => (
            <div
              key={player.userId}
              className={`rl-pawn rl-pawn--${player.status}${player.holding ? ' is-running' : ''}`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                zIndex: 40 + Math.round(point.y),
              }}
            >
              <span className="rl-pawn__shadow" />
              <div className="rl-pawn__sprite">
                <UserAvatar
                  name={player.displayName}
                  avatarId={player.avatarId}
                  user={{ color: player.color }}
                  size={48}
                />
                <span className="rl-pawn__name">{player.displayName}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="rl-hint">
        {holding ? 'Đang chạy…' : 'Giữ Space hoặc giữ chuột trên sân để chạy'}
      </p>
    </div>
  )
}

export default RedLightField
