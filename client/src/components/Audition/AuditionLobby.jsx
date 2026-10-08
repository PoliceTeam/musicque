import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { message } from 'antd'
import { useAuth } from '../../contexts/AuthContext'
import { createAuditionRoom, getMyAuditionRoom, joinAuditionRoom } from '../../services/api'
import { useAuditionRooms } from './useAuditionRoom'
import { ASSET, trackOf } from './auditionConfig'

const STATUS = { waiting: 'Đang chờ', playing: 'Đang nhảy', finished: 'Vừa xong' }

const AuditionLobby = () => {
  const navigate = useNavigate()
  const { user, requireAuth } = useAuth()
  const rooms = useAuditionRooms()
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
    try {
      await joinAuditionRoom(id)
      navigate(`/audition/${id}`)
    } catch (error) {
      fail(error)
    }
  }

  return (
    <div className='au-page' style={{ backgroundImage: `url(${ASSET.stage})` }}>
      <div className='au-lobby-wrap'>
        <header className='au-lobby-head'>
          <Link to='/' className='au-link'>← Trang chủ</Link>
          <h1>Au đi sần</h1>
          <p className='au-sub'>Chủ phòng chọn bài và sân khấu · tối đa 6 người/phòng</p>
        </header>

        {myRoomId && (
          <button type='button' className='au-start au-rejoin' onClick={() => navigate(`/audition/${myRoomId}`)}>
            Quay lại phòng của bạn ({myRoomId})
          </button>
        )}

        <form className='au-create' onSubmit={create}>
          <input className='au-input' placeholder='Tên phòng (tuỳ chọn)' value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <label className='au-check'>
            <input type='checkbox' checked={del} onChange={(e) => setDel(e.target.checked)} /> Chế độ Del
          </label>
          <button type='submit' className='au-start' disabled={busy || Boolean(myRoomId)}>Tạo phòng</button>
        </form>
        <p className='au-hint'>Muốn tập một mình: tạo phòng rồi bấm Bắt đầu luôn.</p>

        <div className='au-rooms'>
          {rooms === null && <div className='au-hint'>Đang tải danh sách phòng…</div>}
          {rooms?.length === 0 && <div className='au-hint'>Chưa có phòng nào. Tạo một phòng đi!</div>}
          {rooms?.map((r) => {
            const mine = r.id === myRoomId
            const full = r.players >= r.maxPlayers
            return (
              <div key={r.id} className={`au-room is-${r.status}`}>
                <div className='au-room__main'>
                  <b>{r.name}</b>
                  <span>{r.host ? `Chủ: ${r.host}` : ''} · ♪ {trackOf(r.songId).label}{r.del ? ' · Del' : ''}</span>
                </div>
                <span className='au-room__count'>{r.players}/{r.maxPlayers}</span>
                <span className={`au-room__status is-${r.status}`}>{STATUS[r.status]}</span>
                {mine ? (
                  <button type='button' className='au-chip-btn' onClick={() => navigate(`/audition/${r.id}`)}>Vào lại</button>
                ) : (
                  <button type='button' className='au-chip-btn' disabled={full || r.status === 'playing' || Boolean(myRoomId)} onClick={() => join(r.id)}>
                    {full ? 'Đủ người' : r.status === 'playing' ? 'Đang nhảy' : 'Vào'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AuditionLobby
