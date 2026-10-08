import SuitPortrait from './SuitPortrait'
const ROLES = { crew: 'Nhân viên', saboteur: 'Kẻ phá hoại' }

export const MatchScreens = ({ state, online, act, leave }) => {
  const lobby = state.phase === 'lobby'
  const host = state.hostId === state.me.userId
  const self = state.roster.find(p => p.userId === state.me.userId)
  const readyCount = state.roster.filter(p => p.ready && p.connected).length
  const canStart = online && state.roster.length >= (state.config?.minPlayers || 4) && state.roster.every(p => p.ready && p.connected)
  const won = !lobby && state.result?.winner === state.me.role
  return <section className={`shift-match-screen sp-panel${!lobby ? won ? ' is-victory' : ' is-defeat' : ''}`} aria-labelledby='shift-match-title'>
    <span className='shift-eyebrow'>{lobby ? 'PHÒNG CHỜ · CA TRỰC BÍ MẬT' : 'CA TRỰC ĐÃ KẾT THÚC'}</span>
    <h1 id='shift-match-title'>{lobby ? 'Chờ đồng đội vào ca' : won ? 'Chiến thắng!' : 'Thất bại'}</h1>
    <p>{lobby ? `Mã phòng ${state.matchId} · ${readyCount}/${state.roster.length} người sẵn sàng` : state.result?.reason}</p>
    {!lobby && <h2>{state.result?.winner === 'crew' ? 'Đội nhân viên chiến thắng' : 'Kẻ phá hoại chiến thắng'}</h2>}
    <div className='shift-lineup'>{state.roster.map(p => <article className={`shift-lineup-player${lobby && p.ready ? ' is-ready' : ''}`} key={p.userId}>
      <SuitPortrait skin={p.skin} />
      <strong>{p.displayName}{p.userId === state.me.userId ? ' · Bạn' : ''}</strong>
      <small>{lobby ? !p.connected ? 'Mất kết nối' : p.ready ? 'Sẵn sàng ✓' : 'Chưa sẵn sàng' : ROLES[p.role]}</small>
      {p.userId === state.hostId && <small>Chủ phòng</small>}
    </article>)}</div>
    {lobby && <p>Cần ít nhất {state.config?.minPlayers || 4} người. Mọi người bấm sẵn sàng, chủ phòng bắt đầu trận.</p>}
    <div className='shift-buttons'>
      {lobby ? <>
        <button className='sp-btn sp-btn--primary' disabled={!online} onClick={() => act({ kind: 'ready' })}>{self?.ready ? 'Hủy sẵn sàng' : 'Tôi sẵn sàng'}</button>
        {host && <button className='sp-btn sp-btn--primary' disabled={!canStart} onClick={() => act({ kind: 'start' })}>Bắt đầu trận</button>}
      </> : host ? <button className='sp-btn sp-btn--primary' disabled={!online} onClick={() => act({ kind: 'rematch' })}>Chơi lại · về phòng chờ</button> : <p>Đang chờ chủ phòng mở trận tiếp theo…</p>}
      <button className='sp-btn' onClick={leave}>Về menu chính</button>
    </div>
  </section>
}
