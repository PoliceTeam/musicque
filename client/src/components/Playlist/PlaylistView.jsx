import React, { useContext } from 'react'
import { Skeleton } from 'antd'
import { PlaylistContext } from '../../contexts/PlaylistContext'
import { useAuth } from '../../contexts/AuthContext'
import { getYouTubeThumbnail } from '../../utils/reactions'
import QuickReactionButtons from '../Home/QuickReactionButtons'
import BidButton from './BidButton'

const scoreClass = (score) => {
  if (score > 0) return 'sp-score sp-score--positive'
  if (score < 0) return 'sp-score sp-score--negative'
  return 'sp-score'
}

const PlaylistView = ({ title = 'Hàng chờ', compact = false }) => {
  const { playlist: rawPlaylist, voteSong, loading, getUserVoteForSong, getLastReactionForSong } =
    useContext(PlaylistContext)
  const playlist = rawPlaylist || []
  const { isAuthenticated, requireAuth } = useAuth()

  const handleVote = async (songId, voteType, reactionEmoji) => {
    if (!requireAuth('Đăng nhập để vote cho bài hát.')) return false

    if (voteType === 'neutral') {
      const currentVote = getUserVoteForSong(songId)
      if (!currentVote) return false
      return voteSong(songId, currentVote, reactionEmoji)
    }

    return voteSong(songId, voteType, reactionEmoji)
  }

  return (
    <section className='sp-panel sp-panel--grow' data-testid='playlist-view'>
      <div className='sp-panel__head'>
        <h2 className='sp-panel__title'>
          <span aria-hidden='true'>🎧</span>
          {title}
        </h2>
        <span className='sp-muted' style={{ fontSize: 12.5, fontWeight: 600 }}>
          {playlist.length} bài
        </span>
      </div>

      <div className='sp-panel__body'>
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} style={{ padding: 12 }} />
        ) : playlist.length === 0 ? (
          <div className='sp-empty'>
            <span className='sp-empty__icon' aria-hidden='true'>
              🎵
            </span>
            <strong>Hàng chờ đang trống</strong>
            <span>
              {isAuthenticated
                ? 'Dán link YouTube ở khung bên trái để mở màn.'
                : 'Đăng nhập để trở thành người thêm bài đầu tiên.'}
            </span>
          </div>
        ) : (
          <div className={`sp-tracklist${compact ? ' sp-tracklist--compact' : ''}`}>
            {playlist.map((song, index) => {
              const addedBy = song.addedBy?.displayName || song.addedBy?.username || 'Ẩn danh'
              const thumbnail = getYouTubeThumbnail(song.youtubeId)

              return (
                <div className='sp-track' key={song._id}>
                  <span className={`sp-track__rank${index === 0 ? ' sp-track__rank--top' : ''}`}>
                    {index + 1}
                  </span>

                  {thumbnail ? (
                    <img className='sp-track__art' src={thumbnail} alt='' loading='lazy' />
                  ) : (
                    <span className='sp-track__art' />
                  )}

                  <div className='sp-track__meta'>
                    <div className='sp-track__title' title={song.title}>
                      {song.title}
                    </div>
                    <div className='sp-track__sub'>
                      <span>{addedBy}</span>
                      {song.message && (
                        <>
                          <span aria-hidden='true'>·</span>
                          <span className='sp-track__note'>“{song.message}”</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className='sp-track__side'>
                    <span
                      className={scoreClass(song.rankScore ?? song.voteScore)}
                      title={
                        song.bidScore
                          ? `${song.voteScore} vote + ${song.bidScore} bid`
                          : undefined
                      }
                    >
                      {(song.rankScore ?? song.voteScore) > 0
                        ? `+${song.rankScore ?? song.voteScore}`
                        : song.rankScore ?? song.voteScore}
                    </span>
                    <BidButton songId={song._id} />
                    <QuickReactionButtons
                      songId={song._id}
                      onVote={handleVote}
                      userVote={getUserVoteForSong(song._id)}
                      lastReactionEmoji={getLastReactionForSong(song._id)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default PlaylistView
