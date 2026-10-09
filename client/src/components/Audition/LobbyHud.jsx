import React, { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Button, Panel, PlayerSlot, Stepper, Text, Toggle } from './hudKit'
import { BOT_SKILLS, CHARACTERS, LOBBY_PANEL_W, RANDOM_STAGE, SONGS, STAGES, trackOf } from './auditionConfig'

// Phòng chờ dựng trong scene WebGL (lớp Hud): danh sách người chơi, chọn bài/sân khấu/nhân vật,
// chế độ Del, thêm bot, cài đặt cá nhân, Sẵn sàng / Bắt đầu. Thay cho bảng HTML trước đây.

const MARGIN = 24
const PAD = 22

const cycle = (list, current, dir) => {
  const i = Math.max(0, list.indexOf(current))
  return list[(i + dir + list.length) % list.length]
}
const charNo = (charId) => Math.max(1, CHARACTERS.findIndex((c) => c.id === charId) + 1)
const STAGE_IDS = [RANDOM_STAGE, ...STAGES.map((s) => s.id)]
// "Tên bài - Ca sĩ" -> 2 dòng: tên bài / ca sĩ · BPM (tên dài không bị cắt mất BPM)
const songLines = (track) => {
  const [title, ...artist] = track.label.split(' - ')
  const bpm = `${Math.round(track.bpm)} BPM`
  return `${title}\n${artist.length ? `${artist.join(' - ')} · ${bpm}` : bpm}`
}
const stageLabel = (id) => (id === RANDOM_STAGE ? 'Ngẫu nhiên mỗi ván' : STAGES.find((s) => s.id === id)?.label || id)

const LobbyHud = ({ lobby }) => {
  const { room, me, isHost, actions } = lobby
  const { width, height } = useThree((s) => s.size)
  const [botSkill, setBotSkill] = useState('normal')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  const track = trackOf(room.songId)
  const full = room.players.length >= room.maxPlayers
  const notReady = room.players.filter((p) => !p.ready).length
  const left = width / 2 - MARGIN - LOBBY_PANEL_W + PAD
  const cw = LOBBY_PANEL_W - PAD * 2
  const top = height / 2 - MARGIN
  const items = []
  let y = top - PAD
  const add = (h, el, gap = 10) => { items.push(el(y)); y -= h + gap }

  add(34, (yy) => <Text key='title' x={left} y={yy} w={cw} h={34} text={room.name} size={24} weight={900} italic gradient />, 4)
  add(22, (yy) => (
    <React.Fragment key='sub'>
      <Text x={left} y={yy} w={cw - 92} h={22} text={`♪ ${Math.round(track.bpm)} BPM · mã phòng ${room.id}`} size={12} color='rgba(243,240,255,0.7)' />
      <Button
        x={left + cw - 86} y={yy} w={86} h={22} size={11} label={copied ? 'Đã chép ✓' : 'Chép link'}
        onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true)) }}
      />
    </React.Fragment>
  ), 12)

  // 6 ô người chơi, 2 cột
  const slotW = (cw - 8) / 2
  const slotH = 32
  for (let row = 0; row < Math.ceil(room.maxPlayers / 2); row++) {
    add(slotH, (yy) => (
      <React.Fragment key={`row${row}`}>
        {[0, 1].map((col) => {
          const p = room.players[row * 2 + col]
          const sx = left + col * (slotW + 8)
          return (
            <React.Fragment key={col}>
              <PlayerSlot
                x={sx} y={yy} w={slotW} h={slotH} empty={!p}
                player={p && { name: p.name, charNo: charNo(p.charId), isBot: p.isBot, skill: p.skill }}
                isMe={p?.userId === me?.userId} isHost={p?.userId === room.hostId} ready={p?.ready}
              />
              {p?.isBot && isHost && room.status !== 'playing' && (
                <Button x={sx + slotW - 24} y={yy - 6} w={20} h={20} radius={10} size={12} label='×' onClick={() => actions.onRemoveBot(p.userId)} />
              )}
            </React.Fragment>
          )
        })}
      </React.Fragment>
    ), 6)
  }
  y -= 8

  if (me && room.status === 'playing') {
    add(30, (yy) => <Text key='busy' x={left} y={yy} w={cw} h={30} text='Phòng đang nhảy, đợi hết bài rồi chơi ván sau nhé.' size={13} color='rgba(243,240,255,0.75)' align='center' />)
    add(36, (yy) => <Button key='leave' x={left} y={yy} w={cw} h={36} label='Rời phòng' variant='ghost' onClick={actions.onLeave} />)
  } else if (me) {
    if (isHost) {
      add(40, (yy) => (
        <Stepper
          key='song' x={left} y={yy} w={cw} h={40} labelW={70} label='Bài hát' value={songLines(track)}
          onPrev={() => actions.onSong(cycle(SONGS.map((s) => s.id), room.songId, -1))}
          onNext={() => actions.onSong(cycle(SONGS.map((s) => s.id), room.songId, 1))}
          disabled={SONGS.length < 2}
        />
      ), 8)
      add(30, (yy) => (
        <Stepper
          key='stage' x={left} y={yy} w={cw} label='Sân khấu' value={stageLabel(room.stageId)}
          onPrev={() => actions.onStage(cycle(STAGE_IDS, room.stageId, -1))}
          onNext={() => actions.onStage(cycle(STAGE_IDS, room.stageId, 1))}
        />
      ), 8)
    } else {
      add(36, (yy) => <Text key='song-ro' x={left} y={yy} w={cw} h={36} text={songLines(track)} size={13} shrink />, 4)
      add(22, (yy) => <Text key='stage-ro' x={left} y={yy} w={cw} h={22} text={`Sân khấu: ${stageLabel(room.stageId)}`} size={13} />, 8)
    }
    add(34, (yy) => (
      <Toggle
        key='del' x={left} y={yy} w={cw} h={34} label='Chế độ Del' on={room.del} disabled={!isHost}
        hint={isHost ? 'Từ level 5 có mũi tên đỏ, phải bấm ngược hướng' : 'Từ level 5 có mũi tên đỏ (chủ phòng chọn)'}
        onClick={isHost ? () => actions.onDel(!room.del) : undefined}
      />
    ), 8)
    if (isHost) {
      add(30, (yy) => (
        <React.Fragment key='bot'>
          <Stepper
            x={left} y={yy} w={cw - 86} label='Thêm bot' value={BOT_SKILLS.find((b) => b.id === botSkill)?.label}
            onPrev={() => setBotSkill(cycle(BOT_SKILLS.map((b) => b.id), botSkill, -1))}
            onNext={() => setBotSkill(cycle(BOT_SKILLS.map((b) => b.id), botSkill, 1))}
          />
          <Button x={left + cw - 78} y={yy} w={78} h={30} label='+ Bot' variant='primary' disabled={full} onClick={() => actions.onAddBot(botSkill)} />
        </React.Fragment>
      ), 10)
    }
    // chọn nhân vật (khoá khi đã Sẵn sàng, trừ chủ phòng)
    const locked = me.ready && !isHost
    add(34, (yy) => (
      <React.Fragment key='chars'>
        <Text x={left} y={yy} w={90} h={34} text={locked ? 'Nhân vật 🔒' : 'Nhân vật'} size={13} color='rgba(243,240,255,0.6)' />
        {CHARACTERS.map((c, i) => (
          <Button
            key={c.id} x={left + 96 + i * 42} y={yy} w={36} h={34} label={String(i + 1)} size={14}
            variant={c.id === me.charId ? 'active' : 'soft'} disabled={locked} onClick={() => actions.onChar(c.id)}
          />
        ))}
      </React.Fragment>
    ), 10)

    add(34, (yy) => (
      <React.Fragment key='howto'>
        <Text x={left} y={yy} w={cw} h={17} text='← ↑ ↓ → đúng chuỗi, rồi Space đúng phách 4.' size={11} color='rgba(243,240,255,0.6)' />
        <Text x={left} y={yy - 17} w={cw} h={17} text='Missed khoá 1 lượt · 3 lượt ở level 9 thì tới Finish Move.' size={11} color='rgba(243,240,255,0.6)' />
      </React.Fragment>
    ), 10)
    if (isHost) {
      add(46, (yy) => (
        <Button
          key='start' x={left} y={yy} w={cw} h={46} size={16} variant='primary' disabled={!room.allReady}
          label={room.allReady ? 'Bắt đầu' : `Chờ ${notReady} người sẵn sàng…`} onClick={actions.onStart}
        />
      ), 8)
    } else {
      add(46, (yy) => (
        <Button
          key='ready' x={left} y={yy} w={cw} h={46} size={16} variant={me.ready ? 'ready' : 'primary'}
          label={me.ready ? '✓ Đã sẵn sàng — bấm để huỷ' : 'Sẵn sàng'} onClick={() => actions.onReady(!me.ready)}
        />
      ), 8)
    }
    add(34, (yy) => <Button key='leave' x={left} y={yy} w={cw} h={34} label='Rời phòng' variant='ghost' onClick={actions.onLeave} />)
  } else if (room.status === 'playing') {
    add(30, (yy) => <Text key='busy' x={left} y={yy} w={cw} h={30} text='Phòng đang nhảy, đợi hết bài rồi vào nhé.' size={13} align='center' />)
    add(34, (yy) => <Button key='back' x={left} y={yy} w={cw} h={34} label='Về sảnh' variant='ghost' onClick={actions.onLeave} />)
  } else {
    add(46, (yy) => <Button key='join' x={left} y={yy} w={cw} h={46} size={16} variant='primary' disabled={full} label={full ? 'Phòng đã đủ người' : 'Vào phòng'} onClick={actions.onJoin} />, 8)
    add(34, (yy) => <Button key='back' x={left} y={yy} w={cw} h={34} label='Về sảnh' variant='ghost' onClick={actions.onLeave} />)
  }

  const panelH = top - y + PAD - 10
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} />
      <Panel x={left - PAD} y={top} w={LOBBY_PANEL_W} h={panelH} />
      {items}
    </>
  )
}

export default LobbyHud
