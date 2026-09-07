/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { message } from 'antd'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { fillRedLightBots, getRedLightState, getStoredToken, joinRedLight, leaveRedLight } from '../services/api'
import { isInLobby } from '../utils/redLight'

export const RedLightContext = createContext(null)

export const useRedLight = () => {
  const context = useContext(RedLightContext)
  if (!context) throw new Error('useRedLight must be used within RedLightProvider')
  return context
}

const DEFAULT_CONFIG = {
  minPlayers: 4,
  maxPlayers: 12,
  countdownMs: 5000,
  intermissionMs: 8000,
  roundMs: 75000,
  payouts: [25, 10, 5],
  dailyPayoutCap: 80,
  runMsForFinish: 13000,
}

export const RedLightProvider = ({ children }) => {
  const { socket, currentSession } = useContext(PlaylistContext)
  const { user, requireAuth, refreshBalance } = useAuth()
  const [state, setState] = useState(null)
  const [receivedAt, setReceivedAt] = useState(Date.now())
  const userRef = useRef(user)
  const holdingRef = useRef(false)

  useEffect(() => { userRef.current = user }, [user])

  const applyState = useCallback((next) => {
    setState(next)
    setReceivedAt(Date.now())
  }, [])

  const loadState = useCallback(async () => {
    try {
      const { data } = await getRedLightState()
      applyState(data)
    } catch {
      /* socket snapshot will resync */
    }
  }, [applyState])

  useEffect(() => { loadState() }, [loadState, currentSession])

  useEffect(() => {
    if (!socket) return undefined
    const onState = (payload) => applyState(payload)
    const onStopped = (payload) => {
      applyState(payload?.state || { active: false, status: 'closed', lobby: [], round: null })
      refreshBalance()
    }
    socket.on('redlight_state', onState)
    socket.on('redlight_stopped', onStopped)
    return () => {
      socket.off('redlight_state', onState)
      socket.off('redlight_stopped', onStopped)
    }
  }, [socket, applyState, refreshBalance])

  useEffect(() => {
    if (!socket || !user) return undefined
    socket.emit('redlight:bind', { token: getStoredToken() })
    return undefined
  }, [socket, user, state?.status])

  const toastedRoundRef = useRef(null)

  useEffect(() => {
    const placements = state?.round?.placements
    const roundNumber = state?.round?.roundNumber
    if (!placements?.length || state?.status !== 'settled') return undefined
    if (toastedRoundRef.current === roundNumber) return undefined
    const mine = placements.find((placement) => String(placement.userId) === String(userRef.current?._id))
    toastedRoundRef.current = roundNumber
    if (mine?.payout > 0) {
      message.success(`🚦 Hạng ${mine.rank}: +${mine.payout} PC`)
      refreshBalance()
    } else if (mine && mine.requestedPayout > 0 && mine.payout === 0) {
      message.info('Bạn đã chạm trần thưởng Đèn xanh Đèn đỏ hôm nay')
      refreshBalance()
    }
    return undefined
  }, [state?.round?.roundNumber, state?.round?.placements, state?.status, refreshBalance])

  const join = useCallback(async () => {
    if (!requireAuth('Đăng nhập để chơi Đèn xanh Đèn đỏ.')) return false
    try {
      const { data } = await joinRedLight(socket?.id)
      applyState(data)
      return true
    } catch (error) {
      message.error(error.response?.data?.message || 'Không vào được phòng chờ')
      return false
    }
  }, [requireAuth, socket, applyState])

  const fillBots = useCallback(async () => {
    if (!requireAuth('Đăng nhập admin để thêm bot thử.')) return false
    try {
      const { data } = await fillRedLightBots(socket?.id)
      applyState(data)
      message.success('Đã thêm bot để đủ người')
      return true
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thêm được bot')
      return false
    }
  }, [requireAuth, socket, applyState])

  const leave = useCallback(async (reason = 'leave') => {
    if (!user) return false
    try {
      const { data } = await leaveRedLight(reason)
      applyState(data)
      holdingRef.current = false
      return true
    } catch {
      return false
    }
  }, [user, applyState])

  const setHolding = useCallback((holding) => {
    const next = Boolean(holding)
    if (holdingRef.current === next) return
    holdingRef.current = next
    if (!socket || !user) return
    socket.emit('redlight:input', { token: getStoredToken(), holding: next })
  }, [socket, user])

  const joined = isInLobby(state, user?._id)
  const config = state?.config || DEFAULT_CONFIG

  return (
    <RedLightContext.Provider
      value={{
        state,
        config,
        receivedAt,
        joined,
        join,
        fillBots,
        leave,
        setHolding,
        loadState,
      }}
    >
      {children}
    </RedLightContext.Provider>
  )
}
