import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, PlusOutlined, SearchOutlined, TeamOutlined, CustomerServiceOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useTheme } from '../../contexts/ThemeContext'
import UserMenu from '../Auth/UserMenu'
import '../../styles/audition-lobby.css'
import { useAuth } from '../../contexts/AuthContext'
import { createAuditionRoom, getMyAuditionRoom, joinAuditionRoom } from '../../services/api'
import { useAuditionRooms } from './useAuditionRoom'
import { ASSET, trackOf } from './auditionConfig'

const STATUS = { waiting: 'Đang chờ', playing: 'Đang nhảy', finished: 'Vừa xong' }

const AuditionLobby = () => {
  const navigate = useNavigate()
  const { user, requireAuth } = useAuth()
  const rooms = useAuditionRooms()
  const { isDark, toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [joiningId, setJoiningId] = useState(null)
  const [name, setName] = useState('')
  const [del, setDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [myRoomId, setMyRoomId] = useState(null)

  useEffect(() => {
    if (!user) { setMyRoomId(null); return }
    getMyAuditionRoom().then(({ data }) => setMyRoomId(data.roomId)).catch(() => {})
  }, [user, rooms])

  const fail = (error) => message.error(error.response?.data?.message || 'Có lỗi xảy ra, thử lại nhé')

  const create = async (e) => {
    e?.preventDefault()
    if (!requireAuth('Đăng nhập để tạo phòng nhảy')) return
    setBusy(true)
    try {
      const { data } = await createAuditionRoom({ name: name.trim() || undefined, del })
      navigate(`/audition/${data.id}`)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  const join = async (id) => {
    if (!requireAuth('Đăng nhập để vào phòng nhảy')) return
    setJoiningId(id)
    try {
      await joinAuditionRoom(id)
      navigate(`/audition/${id}`)
    } catch (error) {
      fail(error)
    } finally {
      setJoiningId(null)
    }
  }

  const available = (r) => r.status !== 'playing' && r.players < r.maxPlayers
  const visibleRooms = rooms?.filter((r) => (!availableOnly || available(r)) && `${r.name} ${r.host || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  const availableCount = rooms?.filter(available).length || 0

  return (
    <div className='au-salon'>
      <div className='au-salon__wrap'>
        <nav className='au-salon__nav' aria-label='Điều hướng sảnh'>
          <Link to='/' className='au-salon__back'><ArrowLeftOutlined /> <b>Musicque</b><span>/ Sảnh nhảy</span></Link>
          <div className='au-salon__account'>
            <button type='button' className='sp-btn sp-btn--ghost sp-btn--icon' onClick={toggleTheme} aria-label={isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}>{isDark ? <SunOutlined /> : <MoonOutlined />}</button>
            <UserMenu />
          </div>
        </nav>

        <header className='au-salon__hero' style={{ backgroundImage: `linear-gradient(90deg, rgba(10, 6, 30, .95), rgba(10, 6, 30, .65) 55%, rgba(10, 6, 30, .12)), url(${ASSET.stage})` }}>
          <div className='au-salon__eyebrow'><CustomerServiceOutlined /> MUSICQUE · NHẢY THEO NHỊP</div>
          <h1>Au đi sần<span>Cùng team lên sàn.</span></h1>
          <p>Chọn một phòng, bật bài yêu thích và bắt nhịp cùng nhau.</p>
          <div className='au-salon__hero-tags'><span><TeamOutlined /> Tối đa 6 người / phòng</span><span>Chơi cùng bạn bè hoặc tập solo</span></div>
        </header>

        {myRoomId && (
          <div className='au-salon__rejoin'>
            <div><strong>Phòng của bạn vẫn đang mở</strong><p>Quay lại để tiếp tục. Bạn cần rời phòng hiện tại trước khi vào phòng khác.</p></div>
            <button type='button' className='sp-btn sp-btn--primary' onClick={() => navigate(`/audition/${myRoomId}`)}>Quay lại phòng <ArrowRightOutlined /></button>
          </div>
        )}

        <main className='au-salon__grid'>
          <section className='sp-panel au-salon__rooms' aria-labelledby='au-rooms-title'>
            <div className='au-salon__section-head'>
              <div><h2 id='au-rooms-title'>Phòng nhảy <span>{rooms?.length ?? '—'}</span></h2><p>{rooms === null ? 'Đang tìm phòng cho bạn…' : `${availableCount} phòng còn chỗ · Danh sách cập nhật tự động`}</p></div>
              <span className='au-salon__live'>Trực tiếp</span>
            </div>
            <div className='au-salon__filters'>
              <label className='au-salon__search'><SearchOutlined /><input aria-label='Tìm phòng hoặc chủ phòng' placeholder='Tìm phòng hoặc chủ phòng' value={query} onChange={(e) => setQuery(e.target.value)} /></label>
              <button type='button' className={`sp-btn sp-btn--sm ${availableOnly ? 'sp-btn--primary' : 'sp-btn--outline'}`} aria-pressed={availableOnly} onClick={() => setAvailableOnly(!availableOnly)}>Còn chỗ</button>
            </div>
            <div className='au-salon__list' aria-live='polite' aria-busy={rooms === null}>
              {rooms === null && <div className='au-salon__empty' role='status'><span className='au-salon__empty-icon'><CustomerServiceOutlined /></span><h3>Đang tải phòng nhảy…</h3><p>Sẵn sàng bắt nhịp cùng team.</p></div>}
              {rooms !== null && visibleRooms.length === 0 && (
                <div className='au-salon__empty'>
                  <span className='au-salon__empty-icon'><CustomerServiceOutlined /></span>
                  <h3>{rooms.length === 0 ? 'Sàn nhảy đang chờ bạn' : 'Chưa tìm thấy phòng phù hợp'}</h3>
                  <p>{rooms.length === 0 ? 'Tạo phòng đầu tiên và rủ cả team cùng chơi. Một mình cũng có thể bắt đầu ngay.' : 'Thử tìm tên khác hoặc xem tất cả phòng đang mở.'}</p>
                  {rooms.length === 0 ? <button type='button' className='sp-btn sp-btn--outline' disabled={Boolean(myRoomId)} onClick={() => document.getElementById('au-room-name')?.focus()}><PlusOutlined /> Tạo phòng đầu tiên</button> : <button type='button' className='sp-btn sp-btn--outline' onClick={() => { setQuery(''); setAvailableOnly(false) }}>Xem tất cả phòng</button>}
                </div>
              )}
              {visibleRooms?.map((r) => {
                const mine = r.id === myRoomId
                const full = r.players >= r.maxPlayers
                const track = trackOf(r.songId)
                return (
                  <article key={r.id} className={`au-salon__room ${mine ? 'is-mine' : ''}`}>
                    <div className='au-salon__cover' aria-hidden='true'><CustomerServiceOutlined /></div>
                    <div className='au-salon__room-info'>
                      <div className='au-salon__room-title'><h3 title={r.name}>{r.name}</h3>{mine && <span className='au-salon__mine'>Phòng của bạn</span>}</div>
                      <p title={track.label}>{track.label} <span>· {Math.round(track.bpm)} BPM</span></p>
                      <span className='au-salon__host'>Chủ phòng: {r.host || 'Đang cập nhật'} · {r.del ? 'Chế độ Del' : 'Chế độ thường'}</span>
                    </div>
                    <div className='au-salon__room-state'><span className={`au-salon__status is-${r.status}`}>{STATUS[r.status] || 'Đang chờ'}</span><span><TeamOutlined /> {r.players}/{r.maxPlayers} người</span></div>
                    <button type='button' className={`sp-btn sp-btn--sm ${mine || available(r) ? 'sp-btn--primary' : 'sp-btn--outline'}`} disabled={!mine && (full || r.status === 'playing' || Boolean(myRoomId) || joiningId !== null)} onClick={() => mine ? navigate(`/audition/${r.id}`) : join(r.id)} aria-label={`${mine ? 'Vào lại' : 'Vào phòng'} ${r.name}`}>
                      {mine ? 'Vào lại' : joiningId === r.id ? 'Đang vào…' : full ? 'Đã đầy' : r.status === 'playing' ? 'Đang nhảy' : 'Vào phòng'}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className='au-salon__aside'>
            <section className='sp-panel au-salon__create' aria-labelledby='au-create-title'>
              <span className='au-salon__create-icon'><PlusOutlined /></span>
              <h2 id='au-create-title'>Mở sàn của bạn</h2>
              <p>Bạn làm chủ phòng, chọn bài và sân khấu sau khi tạo.</p>
              <form onSubmit={create}>
                <label className='au-salon__field' htmlFor='au-room-name'>Tên phòng <span>Không bắt buộc</span></label>
                <input id='au-room-name' className='au-salon__input' placeholder='Ví dụ: Team mình lên sàn' value={name} maxLength={40} onChange={(e) => setName(e.target.value)} disabled={busy || Boolean(myRoomId)} />
                <label className='au-salon__del'>
                  <span><strong>Chế độ Del</strong><small id='au-del-hint'>Từ level 5, bấm ngược hướng mũi tên đỏ.</small></span>
                  <input type='checkbox' role='switch' aria-describedby='au-del-hint' checked={del} onChange={(e) => setDel(e.target.checked)} disabled={busy || Boolean(myRoomId)} />
                </label>
                <button type='submit' className='sp-btn sp-btn--primary au-salon__submit' disabled={busy || Boolean(myRoomId)}><PlusOutlined /> {busy ? 'Đang tạo phòng…' : 'Tạo phòng'}</button>
                <p className='au-salon__form-hint'>{myRoomId ? 'Bạn đang ở một phòng. Quay lại phòng để tiếp tục.' : 'Tập solo? Tạo phòng rồi bấm Bắt đầu ngay.'}</p>
              </form>
            </section>
            <div className='au-salon__guide'><h3>Bắt nhịp trong 3 bước</h3><ol><li>Vào phòng hoặc tạo phòng mới.</li><li>Chủ phòng chọn bài, cả team sẵn sàng.</li><li>Bấm phím mũi tên, chốt nhịp bằng Space.</li></ol></div>
          </aside>
        </main>
      </div>
    </div>
  )
}

export default AuditionLobby
