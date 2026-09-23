import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { getStoredToken } from '../../services/api'
import { WorkspaceScene } from './workspaceScene'

const WorkspaceGame = ({ socket, user, nowPlaying, onZoneChange, onInteract, onError, sceneRef }) => {
  const hostRef = useRef(null)
  const nowPlayingRef = useRef(nowPlaying)

  useEffect(() => {
    nowPlayingRef.current = nowPlaying
    sceneRef.current?.setNowPlaying(nowPlaying)
  }, [nowPlaying, sceneRef])

  useEffect(() => {
    if (!hostRef.current || !socket || !user) return undefined

    let selfId = socket.id
    let sceneReady = false
    let scene
    const join = () => {
      if (!sceneReady) return
      selfId = socket.id
      socket.emit('workspace:join', {
        token: getStoredToken(),
        position: scene.player ? { x: scene.player.x, y: scene.player.y, direction: 'down' } : undefined,
      })
    }
    const onSnapshot = (payload) => {
      selfId = payload.selfId
      scene.setMembers(payload.members || [], selfId)
    }
    const onJoined = (member) => scene.upsertRemote(member)
    const onMoved = (member) => scene.upsertRemote(member)
    const onLeft = ({ socketId }) => scene.removeRemote(socketId)
    const onChat = (message) => scene.showBubble(message, selfId)
    const handleError = ({ message }) => onError(message)

    scene = new WorkspaceScene({
      onZoneChange,
      onInteract,
      onMove: (position) => socket.emit('workspace:move', position),
      onReady: () => {
        sceneReady = true
        scene.setNowPlaying(nowPlayingRef.current)
        if (socket.connected) join()
      },
    })
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: hostRef.current.clientWidth,
      height: hostRef.current.clientHeight,
      backgroundColor: '#eef7ff',
      antialias: true,
      pixelArt: false,
      roundPixels: false,
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
    })
    game.registry.set('userId', user._id)
    game.registry.set('displayName', user.displayName || user.username)
    sceneRef.current = scene

    socket.on('connect', join)
    socket.on('workspace:snapshot', onSnapshot)
    socket.on('workspace:member-joined', onJoined)
    socket.on('workspace:member-moved', onMoved)
    socket.on('workspace:member-left', onLeft)
    socket.on('workspace:chat', onChat)
    socket.on('workspace:error', handleError)

    return () => {
      socket.emit('workspace:leave')
      socket.off('connect', join)
      socket.off('workspace:snapshot', onSnapshot)
      socket.off('workspace:member-joined', onJoined)
      socket.off('workspace:member-moved', onMoved)
      socket.off('workspace:member-left', onLeft)
      socket.off('workspace:chat', onChat)
      socket.off('workspace:error', handleError)
      sceneRef.current = null
      game.destroy(true)
    }
  }, [socket, user, onZoneChange, onInteract, onError, sceneRef])

  return <div ref={hostRef} className='workspace-game' aria-label='Bản đồ Musicque Workspace' />
}

export default WorkspaceGame
