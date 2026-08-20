const Song = require('../models/song.model')
const songSkipService = require('./songSkip.service')
const { emitActivity } = require('../utils/activityEmitter')

const populateSong = (query) => query.populate('addedBy', 'username displayName')

async function getPlaylist(sessionId) {
  return Song.find({ sessionId, playing: false, played: false })
    .populate('addedBy', 'username displayName')
    .populate('votes.userId', 'username displayName')
    .sort({ rankScore: -1, addedAt: 1 })
}

async function advanceCurrentSong({ songId, reason, io }) {
  let refundPool = null
  if (reason !== 'pc_threshold') {
    refundPool = await songSkipService.prepareRefund(songId, reason)
  }

  const completedSong = await Song.findOneAndUpdate(
    { _id: songId, playing: true, played: false },
    { $set: { playing: false, played: true } },
    { new: true },
  )

  if (!completedSong) {
    if (refundPool) await songSkipService.finishRefund(refundPool, io)
    return { advanced: false, currentSong: null, playlist: null }
  }

  const nextSong = await populateSong(
    Song.findOneAndUpdate(
      {
        sessionId: completedSong.sessionId,
        playing: false,
        played: false,
      },
      { $set: { playing: true } },
      { new: true, sort: { rankScore: -1, addedAt: 1 } },
    ),
  )

  await Song.deleteOne({ _id: completedSong._id })
  if (refundPool) await songSkipService.finishRefund(refundPool, io)

  const playlist = await getPlaylist(completedSong.sessionId)
  if (io) {
    io.emit('playlist_updated', playlist)
    io.emit('song_playback_advanced', {
      previousSongId: completedSong._id.toString(),
      currentSong: nextSong,
      reason,
    })

    if (reason === 'pc_threshold') {
      emitActivity(io, {
        type: 'song_skipped_by_pc',
        songTitle: completedSong.title,
        songId: completedSong._id.toString(),
      })
    }
    if (nextSong) {
      emitActivity(io, {
        type: 'now_playing',
        songTitle: nextSong.title,
        songId: nextSong._id.toString(),
        username: nextSong.addedBy?.username,
      })
    }
  }

  return { advanced: true, currentSong: nextSong, playlist }
}

module.exports = { advanceCurrentSong }
