import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UserMenu from '../components/Auth/UserMenu'
import { useSecretShift } from '../components/SecretShift/useSecretShift'
import SuitPortrait from '../components/SecretShift/SuitPortrait'
import ShiftGame from '../components/SecretShift/ShiftGame'
import ShiftVoice from '../components/SecretShift/ShiftVoice'
import { MatchScreens } from '../components/SecretShift/MatchScreens'
import TaskPanel from '../components/SecretShift/TaskPanel'
import { getTargets, secondsLeft } from '../components/SecretShift/targets'
import '../styles/secret-shift.css'

const PHASES = { lobby: 'Phòng chờ', playing: 'Đang làm nhiệm vụ', discussion: 'Thảo luận', voting: 'Bỏ phiếu', ended: 'Kết thúc ca trực' }
const TASK_NAMES = { wiring: 'Nối dây', code: 'Nhập mã', restart: 'Khởi động thiết bị', navigation: 'Chỉnh hướng', garbage: 'Đổ rác', fuel: 'Cấp nhiên liệu' }
const ROLE_NAMES = { crew: 'Nhân viên', saboteur: 'Kẻ phá hoại' }
const clock = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

const Rules = () => <details className='shift-rules'>
  <summary>Luật chơi & điều khiển</summary>
  <p>4–8 người, một kẻ phá hoại. Nhân viên hoàn thành 3 nhiệm vụ mỗi người hoặc bỏ phiếu loại kẻ phá hoại để thắng.
    Kẻ phá hoại thắng khi chỉ còn một nhân viên sống, hoặc ca trực hết 10 phút.</p>
  <p>Bấm bản đồ để điều khiển. WASD / mũi tên: di chuyển. E: tương tác / báo cáo. Q: loại người ở gần.
    Nhân vật nằm trên sàn là dấu hiệu có người bị loại. Họp 45 giây, bỏ phiếu 20 giây; hòa hoặc bỏ qua thì không loại ai.</p>
  <p>Mỗi người gọi họp khẩn một lần. Mất điện tự hết sau 25 giây hoặc đến phòng điện sửa.
    Người bị loại tiếp tục làm nhiệm vụ dưới dạng bóng ma, không được nói hoặc bỏ phiếu.
    Mất kết nối được giữ chỗ 30 giây. Rời trận bị loại, nhiệm vụ còn lại được bỏ khỏi yêu cầu.</p>
  <p>Voice chỉ mở khi chờ, họp và xem kết quả. Không cần micro để chơi; dùng chat chữ trong họp.</p>
</details>

const RoomBrowser = ({ rooms, busy, join }) => {
  const [name, setName] = useState('Ca trực bí mật')
  const [code, setCode] = useState('')
  return <section className='sp-panel shift-browser'>
    <div className='shift-hero'><span className='shift-eyebrow'>GAME SUY LUẬN · 2D · 4–8 NGƯỜI</span>
      <h1>Ca trực bí mật</h1><p>Một ca trực. Một đồng nghiệp đáng ngờ.<br />Hoàn thành ca trực — và tìm ra ai đang phá hoại.</p>
    </div>
    <div className='shift-browser-columns'>
      <div><h2>Tạo ca trực</h2><label htmlFor='shift-room-name'>Tên phòng</label>
        <input id='shift-room-name' maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button className='sp-btn sp-btn--primary' disabled={busy} onClick={() => join(null, name)}>Tạo phòng</button>
        <form onSubmit={(e) => { e.preventDefault(); join(code.trim().toUpperCase()) }}>
          <label htmlFor='shift-room-code'>Vào bằng mã phòng</label>
          <input id='shift-room-code' value={code} maxLength={6} placeholder='VD: A1B2C3' onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className='sp-btn' disabled={busy || code.trim().length !== 6}>Vào phòng</button>
        </form>
      </div>
      <div><h2>Phòng đang mở</h2>
        {!rooms?.length && <p>Chưa có phòng nào. Tạo phòng rồi gửi mã cho đồng nghiệp.</p>}
        {rooms?.map((room) => <div className='shift-room-row' key={room.id}>
          <div><strong>{room.name}</strong><small>{room.id} · {room.count}/8 · {PHASES[room.phase]}</small></div>
          <button className='sp-btn' disabled={busy || room.phase !== 'lobby' || room.count >= 8} onClick={() => join(room.id)}>Tham gia</button>
        </div>)}
      </div>
    </div>
    <Rules />
  </section>
}

const Meeting = ({ state, act, online, now }) => {
  const [chat, setChat] = useState('')
  const [sending, setSending] = useState(false)
  const me = state.me
  const voting = state.phase === 'voting'
  return <div className='shift-meeting sp-panel' role='dialog' aria-modal='true' aria-labelledby='shift-meeting-title'>
    <h2 id='shift-meeting-title'>{voting ? 'Ai đang phá hoại?' : 'Họp ca trực'}</h2>
    <strong className='shift-timer'>{clock(secondsLeft(state.phaseEndsAt, now))}</strong>
    <p>{state.meeting.caller}: {state.meeting.reason}</p>
    <div className='shift-vote-grid'>
      {state.roster.map((p) => <button key={p.userId} className={`shift-player-choice${!p.alive ? ' is-dead' : ''}`}
        disabled={!online || !voting || !me.alive || !p.alive || state.meeting.myVote !== undefined}
        onClick={() => act({ kind: 'vote', targetId: p.userId })}>
        <SuitPortrait skin={p.skin} />
        <strong>{p.displayName}</strong><small>{!p.alive ? 'Đã bị loại' : state.meeting.votedIds.includes(p.userId) ? 'Đã bỏ phiếu' : 'Còn sống'}</small>
      </button>)}
    </div>
    {voting && <button className='sp-btn' disabled={!online || !me.alive || state.meeting.myVote !== undefined}
      onClick={() => act({ kind: 'vote', targetId: 'skip' })}>Bỏ qua</button>}
    {state.meeting.myVote !== undefined && <p>Đã ghi nhận phiếu của bạn.</p>}
    {!me.alive && <p>Bạn đang theo dõi cuộc họp. Bóng ma không được chat hoặc bỏ phiếu.</p>}
    <div className='shift-chat-log' role='log' aria-label='Tin nhắn cuộc họp'>
      {state.meeting.messages.map((m) => <p key={m.id}><strong>{m.displayName}: </strong>{m.content}</p>)}
    </div>
    <form className='shift-chat-form' onSubmit={async (e) => {
      e.preventDefault(); if (sending || !chat.trim()) return
      setSending(true); if (await act({ kind: 'chat', content: chat.trim() })) setChat(''); setSending(false)
    }}>
      <input aria-label='Tin nhắn cuộc họp' maxLength={240} placeholder='Nêu điều bạn đã thấy…' value={chat}
        onChange={(e) => setChat(e.target.value)} disabled={!me.alive || !online} />
      <button className='sp-btn' disabled={sending || !chat.trim() || !me.alive || !online}>Gửi</button>
    </form>
  </div>
}

const SecretShiftPage = () => {
  const { socket, user, state, catalog, error, busy, online, join, act, leave } = useSecretShift()
  const [localNow, setLocalNow] = useState(Date.now())
  const [confirmLeave, setConfirmLeave] = useState(false)
  useEffect(() => { const timer = setInterval(() => setLocalNow(Date.now()), 200); return () => clearInterval(timer) }, [])
  const offset = state?.clockOffset || 0
  const now = localNow + offset
  const targets = getTargets(state)
  const [holdingReactor, setHoldingReactor] = useState(false)
  const reactorPanelId = targets.reactorPanel?.id
  useEffect(() => {
    if (!holdingReactor || !reactorPanelId || !online) return
    const send = () => act({ kind: 'reactorHold', panelId: reactorPanelId })
    send(); const timer = setInterval(send, 500)
    return () => clearInterval(timer)
  }, [holdingReactor, reactorPanelId, online, act])
  const interact = () => {
    if (!online || !state || state.me.challenge) return
    if (targets.body) act({ kind: 'report', bodyId: targets.body.id })
    else if (targets.repair) act({ kind: 'repair' })
    else if (targets.task) act({ kind: 'taskBegin', taskId: targets.task.id })
    else if (targets.emergency) act({ kind: 'emergency' })
  }
  const kill = () => {
    if (online && targets.victim && now >= state.me.killReadyAt) act({ kind: 'kill', targetId: targets.victim.userId })
  }
  const active = state && !['lobby', 'ended'].includes(state.phase)
  const meeting = state && ['discussion', 'voting'].includes(state.phase)
  const location = state?.map.rooms.find((r) => state.me.x >= r.x && state.me.x <= r.x + r.width && state.me.y >= r.y && state.me.y <= r.y + r.height)
  return <div className={`shift-shell${meeting ? ' is-meeting' : ''}`}>
    <header className='shift-header'>
      <Link to='/workspace' className='shift-brand'>← Workspace</Link><strong>Ca trực bí mật</strong><UserMenu />
    </header>
    <main>
      {!online && <div className='shift-alert' role='status'>Đang kết nối lại… Bạn có 30 giây để trở lại trận.</div>}
      {error && <div className='shift-alert' role='alert'>{error}</div>}
      {!state ? <RoomBrowser rooms={catalog?.rooms} busy={busy || !online} join={join} /> : <>
        <section className='shift-phase-bar sp-panel'>
          <div><strong>{state.name}</strong><small>Mã phòng: <b>{state.matchId}</b> · {PHASES[state.phase]}</small></div>
          <div className='shift-timer'>{active ? clock(secondsLeft(state.phaseEndsAt || state.gameEndsAt, now)) : `${state.roster.length}/8 người`}</div>
          <button className='sp-btn' onClick={() => active ? setConfirmLeave(true) : leave()}>Rời phòng</button>
        </section>
        {confirmLeave && <div className='shift-alert'>Rời trận sẽ loại nhân vật của bạn.
          <button className='sp-btn' onClick={() => { setConfirmLeave(false); leave() }}>Rời trận</button>
          <button className='sp-btn' onClick={() => setConfirmLeave(false)}>Ở lại</button>
        </div>}
        {['lobby', 'ended'].includes(state.phase) ? <>
          <MatchScreens state={state} online={online} act={act} leave={leave} />
          {socket && user && <ShiftVoice socket={socket} matchId={state.matchId} canSpeak={state.me.canSpeak} />}
          <Rules />
        </> : <div className='shift-layout'>
          <section className='shift-stage'>
            <ShiftGame state={state} socket={socket} online={online} onInteract={interact} onKill={kill} />
            <span className='shift-location'>{location?.name || 'Hành lang'} · Bấm bản đồ để điều khiển</span>
            {state.phase === 'playing' && <div className='shift-actions'>
              {targets.reactorPanel && <button className='sp-btn' onPointerDown={() => setHoldingReactor(true)} onPointerUp={() => setHoldingReactor(false)} onPointerLeave={() => setHoldingReactor(false)}>Giữ máy quét {holdingReactor ? '●' : ''}</button>}
              {state.me.ventId ? <>
                <button className='sp-btn' onClick={() => act({ kind: 'ventExit' })} disabled={!online}>Ra khỏi vent</button>
                {(state.map.vents.find(v => v.id === state.me.ventId)?.links || []).map(id => <button className='sp-btn' key={id} disabled={!online} onClick={() => act({ kind: 'ventTravel', ventId: id })}>Vent → {id}</button>)}
              </> : targets.vent && <button className='sp-btn' disabled={!online} onClick={() => act({ kind: 'ventEnter', ventId: targets.vent.id })}>Vào vent</button>}
              <button className='sp-btn' disabled={!online || (!targets.body && !targets.task && !targets.emergency && !targets.repair)} onClick={interact}>
                <kbd>E</kbd> {targets.body ? 'Báo cáo' : targets.repair ? 'Sửa điện' : targets.task ? TASK_NAMES[targets.task.kind] : targets.emergency ? 'Họp khẩn' : 'Đến gần thiết bị'}
              </button>
              {state.me.alive && state.me.role === 'saboteur' && <>
                <button className='sp-btn shift-danger' disabled={!online || !targets.victim || now < state.me.killReadyAt} onClick={kill}>
                  <kbd>Q</kbd> Loại người {now < state.me.killReadyAt ? `(${secondsLeft(state.me.killReadyAt, now)}s)` : ''}
                </button>
                <button className='sp-btn shift-danger' disabled={!online || now < state.me.sabotageReadyAt || !!state.lightsUntil || !!state.reactor || !!state.me.ventId}
                  onClick={() => act({ kind: 'sabotage' })}>Mất điện {now < state.me.sabotageReadyAt ? `(${secondsLeft(state.me.sabotageReadyAt, now)}s)` : ''}</button>
                {state.map.reactorPanels && <button className='sp-btn shift-danger' disabled={!online || !!state.me.ventId || !!state.reactor || !!state.lightsUntil || now < state.me.sabotageReadyAt} onClick={() => act({ kind: 'reactorSabotage' })}>Phá lò phản ứng</button>}
              </>}
            </div>}
          </section>
          <aside className='shift-rail sp-panel'>
            <>
              <div className={`shift-role${state.me.role === 'saboteur' ? ' is-saboteur' : ''}`}>
                <small>VAI TRÒ CỦA BẠN</small><h2>{ROLE_NAMES[state.me.role]}</h2>
                <p>{!state.me.alive ? 'Bạn là bóng ma. Tiếp tục nhiệm vụ, giữ bí mật với người còn sống.' : state.me.role === 'crew' ? 'Hoàn thành công việc và tìm kẻ phá hoại.' : 'Giả làm nhiệm vụ. Tránh bị phát hiện.'}</p>
              </div>
              <label htmlFor='shift-task-progress'>Tiến độ cả đội · {state.progress.done}/{state.progress.total}</label>
              <progress id='shift-task-progress' value={state.progress.done} max={state.progress.total || 1} />
              {state.me.tasks.map((t) => <div className={`shift-task-row${t.done ? ' is-done' : ''}`} key={t.id}>
                <span>{t.done ? '✓' : '○'}</span><div><strong>{TASK_NAMES[t.kind]}</strong><small>{t.roomName}</small></div>
              </div>)}
              {state.reactor && <p className='shift-alert'>Lò phản ứng quá tải · {secondsLeft(state.reactor.endsAt, now)}s · Hai người giữ hai máy quét để sửa.</p>}
              {state.lightsUntil > 0 && <p className='shift-alert'>Mất điện! Đến phòng điện để sửa · {secondsLeft(state.lightsUntil, now)}s</p>}
              {state.notice && <p>{state.notice}</p>}
              <details className='shift-map-key'><summary>Bản đồ {state.map.rooms.length} phòng</summary>
                <div>{state.map.rooms.map((r) => <span key={r.id} className={location?.id === r.id ? 'is-current' : ''}>{r.name}</span>)}</div>
              </details>
            </>
            {socket && user && <ShiftVoice socket={socket} matchId={state.matchId} canSpeak={state.me.canSpeak} />}
            <Rules />
          </aside>
        </div>}
        {meeting && <div className='shift-modal-backdrop'><Meeting state={state} act={act} online={online} now={now} /></div>}
        {state.me.challenge && <TaskPanel challenge={state.me.challenge} now={now} act={act} online={online} />}
      </>}
    </main>
  </div>
}
export default SecretShiftPage
