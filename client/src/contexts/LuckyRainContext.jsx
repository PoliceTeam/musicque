import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { PlaylistContext } from './PlaylistContext'
import { useAuth } from './AuthContext'
import { claimLuckyRain, getLuckyRainState } from '../services/api'
import { LuckyRainContext } from './luckyRainState'

export function LuckyRainProvider({ children }) {
  const { socket, currentSession } = useContext(PlaylistContext)
  const { user, setBalance, refreshBalance } = useAuth()
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const clockOffset = useRef(0)
  const requestNumber = useRef(0)
  const invalidateRequests = useCallback(() => { ++requestNumber.current }, [])
  const userId = user?._id
  const identity = useRef(userId)
  identity.current = userId
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const tick = setInterval(() => setNow(Date.now() + clockOffset.current), 250)
    return () => { mounted.current = false; clearInterval(tick) }
  }, [])

  const refresh = useCallback(async () => {
    const number = ++requestNumber.current
    const started = Date.now()
    try {
      const { data } = await getLuckyRainState()
      if (!mounted.current || number !== requestNumber.current || identity.current !== userId) return null
      clockOffset.current = data.serverNow - (started + Date.now()) / 2
      setNow(Date.now() + clockOffset.current)
      setState(data)
      setError('')
      if (Number.isFinite(data.balance)) setBalance(data.balance)
      else if (data.claim?.settled) refreshBalance()
      return data
    } catch (requestError) {
      if (mounted.current && number === requestNumber.current) {
        setError(requestError.response?.data?.message || 'Chưa tải được lịch lì xì')
      }
      return null
    }
  }, [userId, setBalance, refreshBalance])

  useEffect(() => {
    setState(null)
    refresh()
    const polling = setInterval(refresh, 30000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      invalidateRequests()
      clearInterval(polling)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
    }
  }, [refresh, currentSession?._id, invalidateRequests])

  useEffect(() => {
    if (!socket) return undefined
    // Broadcast chỉ chứa lịch chung. Refetch để lấy claim đúng tài khoản.
    socket.on('lucky_rain_state', refresh)
    socket.on('connect', refresh)
    return () => {
      socket.off('lucky_rain_state', refresh)
      socket.off('connect', refresh)
    }
  }, [socket, refresh])

  const boundary = state?.round?.open ? state.round.closesAt : state?.nextOpensAt
  useEffect(() => {
    if (!boundary) return undefined
    const delay = Math.max(200, boundary - Date.now() - clockOffset.current + 150)
    const timer = setTimeout(refresh, delay)
    return () => clearTimeout(timer)
  }, [boundary, refresh])

  const claim = useCallback(async (roundId) => {
    const claimant = identity.current
    const { data } = await claimLuckyRain(roundId)
    if (!mounted.current || identity.current !== claimant) return null
    // GET đã bắt đầu trước claim có thể mang trạng thái chưa nhận: bỏ phản hồi
    // đó để nó không ghi đè phần thưởng vừa được xác nhận.
    invalidateRequests()
    // Giữ lại kết quả đang mở nếu đợt mới đã bắt đầu, nhưng không gán claim
    // cũ vào đợt mới. Phản hồi nhận là nguồn kết quả, không dùng random UI.
    setState((previous) => previous?.round?.id === data.claim.roundId
      ? { ...previous, claim: data.claim } : previous)
    setBalance(data.balance)
    return data.claim
  }, [setBalance, invalidateRequests])

  const available = Boolean(state?.active && state.round?.open &&
    now >= state.round.opensAt && now < state.round.closesAt)

  return <LuckyRainContext.Provider value={{ state, now, available, error, refresh, claim }}>
    {children}
  </LuckyRainContext.Provider>
}
