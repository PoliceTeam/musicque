import React, { lazy, Suspense, useCallback, useContext, useRef, useState } from 'react'
import { Drawer, Modal, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PlaylistContext } from '../contexts/PlaylistContext'
import { useAuth } from '../contexts/AuthContext'
import UserMenu from '../components/Auth/UserMenu'
import AddSongForm from '../components/Playlist/AddSongForm'
import PlaylistView from '../components/Playlist/PlaylistView'
import WorkspaceGame from '../components/Workspace/WorkspaceGame'
import WorkspaceVoice from '../components/Workspace/WorkspaceVoice'
import '../styles/workspace.css'

const NewsReaderModal = lazy(() => import('../components/News/NewsReaderModal'))
const NesGame = lazy(() => import('../components/NesGame/NesGame'))
const LotteryOverlay = lazy(() => import('../components/Lottery/LotteryOverlay'))
const ChohanOverlay = lazy(() => import('../components/Chohan/ChohanOverlay'))
const BilliardsOverlay = lazy(() => import('../components/Billiards/BilliardsOverlay'))

const zoneLabels = {
  music: 'Music Club',
  game: 'Arcade',
  news: 'News Cafe',
}

const WorkspacePage = () => {
  const navigate = useNavigate()
  const { socket, currentSong } = useContext(PlaylistContext)
  const { user } = useAuth()
  const sceneRef = useRef(null)
  const [nearbyZone, setNearbyZone] = useState(null)
  const [voiceRoomId, setVoiceRoomId] = useState(null)
  const [activeZone, setActiveZone] = useState(null)
  const [chat, setChat] = useState('')
  const [nesGame, setNesGame] = useState(null)
  const [activeGame, setActiveGame] = useState(null)

  const openZone = useCallback((zoneId) => setActiveZone(zoneId), [])
  const showActiveSpeakers = useCallback((socketIds) => sceneRef.current?.setSpeakingSocketIds(socketIds), [])
  const showError = useCallback((text) => message.error(text), [])
  const openArcadeGame = (gameId) => {
    setActiveZone(null)
    setActiveGame(gameId)
  }
  const openNesGame = (game) => {
    setActiveZone(null)
    setNesGame(game)
  }

  const sendChat = (event) => {
    event.preventDefault()
    const content = chat.trim()
    if (!content || !socket) return
    socket.emit('workspace:chat', { content })
    setChat('')
  }

  return (
    <div className='workspace-shell'>
      <header className='workspace-topbar'>
        <button type='button' className='workspace-brand' onClick={() => navigate('/')}>
          <img src='/brand/favicon.svg' alt='' width='34' height='34' />
          <span><strong>Musicque Workspace</strong><small>Social pixel space</small></span>
        </button>
        <div className='workspace-help' aria-label='Hướng dẫn điều khiển'>
          <kbd>↑ ↓ ← →</kbd><span>di chuyển</span><kbd>E</kbd><span>tương tác</span>
        </div>
        <UserMenu />
      </header>

      <main className='workspace-stage'>
        <WorkspaceGame
          socket={socket}
          user={user}
          nowPlaying={currentSong?.title || ''}
          onZoneChange={setNearbyZone}
          onInteract={openZone}
          onError={showError}
          onVoiceRoomChange={setVoiceRoomId}
          sceneRef={sceneRef}
        />

        <WorkspaceVoice socket={socket} roomId={voiceRoomId} onActiveSpeakersChange={showActiveSpeakers} />

        <div className='workspace-now-playing-sr' aria-live='polite'>
          {currentSong?.title ? `Đang phát: ${currentSong.title}` : 'Chưa có bài hát đang phát'}
        </div>

        <div className='workspace-status' aria-live='polite'>
          <span className={`workspace-dot${socket?.connected ? ' is-online' : ''}`} />
          {socket?.connected ? 'Đã kết nối' : 'Đang kết nối lại…'}
        </div>

        {nearbyZone && (
          <button type='button' className='workspace-prompt' onClick={() => openZone(nearbyZone.id)}>
            <kbd>E</kbd> Vào {zoneLabels[nearbyZone.id]}
          </button>
        )}

        <form className='workspace-chat' onSubmit={sendChat}>
          <label htmlFor='workspace-chat-input'>Nói với mọi người</label>
          <div>
            <input
              id='workspace-chat-input'
              value={chat}
              onChange={(event) => setChat(event.target.value.slice(0, 120))}
              maxLength={120}
              placeholder='Nhập tin nhắn…'
              autoComplete='off'
            />
            <button type='submit' disabled={!chat.trim()}>Gửi</button>
          </div>
        </form>
        <a
          className='workspace-credits'
          href='https://axulart.itch.io/small-8-direction-characters'
          target='_blank'
          rel='noopener noreferrer'
        >
          Nhân vật: AxulArt · CC BY 4.0
        </a>
      </main>

      <Drawer
        open={activeZone === 'music'}
        onClose={() => setActiveZone(null)}
        title='🎧 Music Club'
        width='min(720px, 94vw)'
        className='workspace-drawer'
      >
        <section className='sp-panel workspace-music-form'>
          <div className='sp-panel__head'><h2 className='sp-panel__title'>Thêm bài hát</h2></div>
          <div className='sp-panel__body'><AddSongForm variant='main' /></div>
        </section>
        <PlaylistView compact title='Hàng chờ trong club' />
      </Drawer>

      <Modal
        open={activeZone === 'game'}
        onCancel={() => setActiveZone(null)}
        footer={null}
        title='🕹️ Arcade'
        centered
        width='min(760px, 94vw)'
        className='workspace-zone-modal'
      >
        <div className='workspace-game-grid'>
          <button type='button' onClick={() => openArcadeGame('lottery')}>
            <span>🎰</span><strong>Lô đề</strong><small>Chọn số may mắn cùng mọi người</small>
          </button>
          <button type='button' onClick={() => openArcadeGame('chohan')}>
            <span>🎴</span><strong>Cho-Han</strong><small>Cược chẵn lẻ bằng Polite Coins</small>
          </button>
          <button type='button' onClick={() => openArcadeGame('billiards')}>
            <span>🎱</span><strong>Bi-a 9 bóng</strong><small>Theo dõi ván đấu và đặt kèo</small>
          </button>
          <button type='button' onClick={() => openNesGame({ file: '/nes/contra.nes', name: 'Contra' })}>
            <span>🔫</span><strong>Contra</strong><small>NES co-op cổ điển</small>
          </button>
          <button type='button' onClick={() => openNesGame({ file: '/nes/super_mario.nes', name: 'Super Mario' })}>
            <span>🍄</span><strong>Super Mario</strong><small>Đi cảnh tuổi thơ</small>
          </button>
          <button type='button' onClick={() => navigate('/xiangqi')}>
            <span>♟️</span><strong>Cờ tướng</strong><small>Giải thế nhận PC</small>
          </button>
        </div>
      </Modal>

      <Suspense fallback={null}>
        {activeGame === 'lottery' && <LotteryOverlay open onClose={() => setActiveGame(null)} />}
        {activeGame === 'chohan' && <ChohanOverlay open onClose={() => setActiveGame(null)} />}
        {activeGame === 'billiards' && <BilliardsOverlay open onClose={() => setActiveGame(null)} />}
      </Suspense>

      {activeZone === 'news' && (
        <Suspense fallback={null}>
          <NewsReaderModal open onClose={() => setActiveZone(null)} />
        </Suspense>
      )}

      {nesGame && (
        <Suspense fallback={null}>
          <NesGame gameFile={nesGame.file} gameName={nesGame.name} onClose={() => setNesGame(null)} />
        </Suspense>
      )}
    </div>
  )
}

export default WorkspacePage
